import { generateText, type LanguageModel } from "ai";

import { z } from "zod";

import { buildUserContext } from "@/server/ai/context";
import { parseAiPrefs } from "@/server/ai/prefs";
import { systemPrompt } from "@/server/ai/prompt";
import { resolveModel } from "@/server/ai/providers";
import { getTrends, trendSummary } from "@/server/ai/trends";
import { dayKeyInTimeZone, shiftDayKey } from "@/lib/timezone";

/**
 * Draft the weekly review (spec §6.2: "pre-filled by AI on request", ADR-116).
 *
 * Two rules shape this, and both come from the brief work (ADR-075):
 *
 * 1. **It saves nothing.** A review is a claim about somebody's own week. The model may propose the
 *    words; the review that gets written is the one the user kept. So this returns text, the wizard
 *    puts it in the form, and `completeReview` stays the only writer.
 * 2. **It is user-initiated only.** The Friday cron does not call this. Someone pressing "draft with
 *    AI" is asking now, and a button that is not there is enough of an opt-in.
 *
 * The model is overridable so the shape is testable with the scripted model and no provider key
 * (ADR-076); a user with no provider configured gets a named reason rather than a broken button.
 */

export type ReviewPeriod = "weekly" | "monthly";

export interface ReviewDraft {
  wins: string;
  lessons: string;
  next: string;
}

export type DraftResult = { ok: true; data: ReviewDraft } | { ok: false; reason: string };

/**
 * The markers the model is asked to emit, and the ones `parseDraft` reads back. One table for both,
 * because they are the same protocol: a marker added to the prompt and not the parser (or the
 * reverse) is a draft that silently loses an answer, and it would show up as "the draft came back
 * unusable" on somebody's real week.
 */
const MARKERS = { wins: "WINS", lessons: "LESSONS", next: "NEXT" } as const;

const SYSTEM = [
  "You help someone write their own weekly review.",
  "You are given real numbers from their week: what they completed, how much they focused, and",
  "how their habits held. Use those numbers as evidence.",
  "",
  "Reply in exactly this format and nothing else — no preamble, no markdown headings:",
  `${MARKERS.wins}:`,
  "<2-4 short lines of what actually moved forward>",
  `${MARKERS.lessons}:`,
  "<1-3 short lines of what got in the way>",
  `${MARKERS.next}:`,
  "<2-4 short lines of what matters next week>",
  "",
  "Rules: be specific and concrete, never motivational. If the numbers are thin, say what is thin",
  "rather than inventing progress. Never invent a number that is not in the brief. Write in the",
  "user's own second person.",
].join("\n");

/**
 * Pull the three answers out of whatever the model actually returned.
 *
 * A line walk rather than three regexes. This started as a regex and was wrong twice in a row: a
 * trailing `\s*$` ate the newline before `$` could match the line end, and then the lookahead's own
 * `$` matched at the *current* position — already a line boundary — so the lazy group captured
 * nothing. Both failures are silent, and a silent empty parse here is the worst kind of bug: it
 * looks exactly like a model that ignored the format, so the user is told to retry when the parser
 * is what is wrong.
 *
 * Walking lines has no such failure mode, and it reads the way the format is specified: a marker
 * line opens a section, everything until the next marker belongs to it. A marker with its text on
 * the same line is accepted, because models do that.
 */
export function parseDraft(text: string): ReviewDraft {
  // Built from `MARKERS`, so the parser cannot drift from the prompt that asks for these names.
  const marker = new RegExp(
    `^\\s*(${(Object.keys(MARKERS) as Array<keyof ReviewDraft>).join("|")})\\s*:\\s*(.*)$`,
    "i",
  );
  const sections: Record<keyof ReviewDraft, string[]> = { wins: [], lessons: [], next: [] };
  let open: keyof ReviewDraft | null = null;

  for (const line of text.split(/\r?\n/)) {
    const match = marker.exec(line);
    if (match) {
      const key = match[1]!.toLowerCase() as keyof ReviewDraft;
      // A repeated marker restarts the section rather than appending, so a model that restates
      // the prompt and answers twice leaves the last answer, not both copies.
      sections[key] = [];
      open = key;
      // Text on the marker line is the first line of that answer.
      if (match[2]!.trim()) sections[key].push(match[2]!.trim());
      continue;
    }
    // Anything before the first marker is a preamble and is dropped: it is not one of the three
    // answers, and putting it in `wins` would save a review that opens with "Sure! Here's...".
    if (open === null) continue;
    if (line.trim()) sections[open].push(line.trim());
  }

  return {
    wins: sections.wins.join("\n"),
    lessons: sections.lessons.join("\n"),
    next: sections.next.join("\n"),
  };
}

/** True when all three answers carry something — a draft with two empty thirds is not a draft. */
export const isUsableDraft = (draft: ReviewDraft): boolean =>
  draft.wins !== "" && draft.lessons !== "" && draft.next !== "";

export async function draftReview(
  userId: string,
  period: ReviewPeriod,
  now: Date = new Date(),
  modelOverride?: LanguageModel,
): Promise<DraftResult> {
  const prefs = await parseAiPrefs(userId);
  const resolved = await resolveModel(userId, prefs);
  const model = modelOverride ?? resolved?.model;
  if (!model) {
    return { ok: false, reason: "no provider configured" };
  }

  // The window follows the cadence: a weekly review looks at a week, a monthly one at a month.
  // `getTrends` takes a day count and clamps it itself, so the window cannot be mis-specified here.
  const days = period === "weekly" ? 7 : 30;
  const to = dayKeyInTimeZone(now, "UTC");
  const from = shiftDayKey(to, -(days - 1));

  const trends = await getTrends(userId, days, now);
  const context = await buildUserContext(userId, prefs);

  const { text } = await generateText({
    model,
    system: `${systemPrompt(context)}\n\n${SYSTEM}`,
    prompt: `Period: ${period} (${from} to ${to}).\n\n${trendSummary(trends)}`,
  });

  const draft = parseDraft(text);
  if (!isUsableDraft(draft)) {
    // Named rather than shown as three empty boxes: a blank form is indistinguishable from a bug.
    return { ok: false, reason: "the draft came back unusable — try again" };
  }
  return { ok: true, data: draft };
}

/**
 * Whether the button should be offered at all, so no provider means no button rather than a dead
 * one. Takes the id rather than reading the session: a service that reached for the request would be
 * unusable from a test or a cron, and the caller already has a session in hand.
 */
export async function reviewDraftAvailable(userId: string): Promise<boolean> {
  const prefs = await parseAiPrefs(userId);
  return (await resolveModel(userId, prefs)) !== null;
}

/** The zod shape the action validates against, kept next to the parser it mirrors. */
export const reviewDraftSchema = z.object({
  wins: z.string().max(20_000),
  lessons: z.string().max(20_000),
  next: z.string().max(20_000),
});
