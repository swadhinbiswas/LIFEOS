import { generateText, type LanguageModel } from "ai";
import { eq, isNotNull } from "drizzle-orm";

import { db } from "@/server/db";
import { user_settings, users } from "@/server/db/schema";
import { sendEmail } from "@/server/email";
import { createNotification } from "@/server/notifications";
import { getDailyBrief } from "@/server/boards/brief";
import { getAiPrefs, getTimeZone } from "@/server/settings";

import { buildUserContext } from "./context";
import { parseAiPrefs, type AiPrefs } from "./prefs";
import { systemPrompt } from "./prompt";
import { resolveModel } from "./providers";

/**
 * Proactive, quiet copilot messages (spec §8): an optional morning brief and a Friday review draft,
 * off by default and generated on a schedule. The cron route calls `runProactive`; delivery is an
 * in-app notification (and optionally email), deduped per day so a retried cron cannot double-send.
 *
 * The model is overridable so the behaviour is testable without a provider key.
 */

export type ProactiveKind = "brief" | "review";

export interface ProactiveResult {
  userId: string;
  kind: ProactiveKind;
  delivered: boolean;
  skipped: string;
}

/** Users who opted into at least one proactive message. */
export async function listProactiveUsers(): Promise<Array<{ userId: string; prefs: AiPrefs }>> {
  const rows = await db
    .select({ userId: user_settings.user_id, aiPrefs: user_settings.ai_prefs })
    .from(user_settings)
    .where(isNotNull(user_settings.ai_prefs));
  return rows
    .map((row) => ({ userId: row.userId, prefs: parseAiPrefs(row.aiPrefs) }))
    .filter((row) => row.prefs.morningBrief !== "off" || row.prefs.fridayReview);
}

const dayKey = (now: Date): string => now.toISOString().slice(0, 10);
const isFriday = (now: Date): boolean => now.getUTCDay() === 5;

async function promptFor(userId: string, kind: ProactiveKind, now: Date): Promise<string> {
  if (kind === "review") {
    return "Draft a concise weekly review (5–8 short lines): what moved, what stalled, and what to plan next.";
  }
  const timeZone = await getTimeZone(userId);
  const brief = await getDailyBrief(userId, now, timeZone);
  const top = brief.top.map((card) => `- ${card.title}`).join("\n");
  return [
    "Write a short morning brief (3–5 lines) for today, warm and concrete.",
    `Overdue: ${brief.overdue.length}. Due today: ${brief.dueToday.length}. Open: ${brief.openCards}.`,
    top ? `Top cards:\n${top}` : "No top cards yet.",
  ].join("\n");
}

export async function deliverProactive(
  userId: string,
  kind: ProactiveKind,
  now: Date = new Date(),
  modelOverride?: LanguageModel,
): Promise<ProactiveResult> {
  const prefs = await getAiPrefs(userId);
  const resolved = await resolveModel(userId, prefs);
  const model = modelOverride ?? resolved?.model;
  if (!model) return { userId, kind, delivered: false, skipped: "no provider configured" };

  const context = await buildUserContext(userId, prefs);
  const { text } = await generateText({
    model,
    system: systemPrompt(context),
    prompt: await promptFor(userId, kind, now),
  });

  const delivered = await createNotification(userId, {
    kind: "system",
    title: kind === "brief" ? "Morning brief" : "Weekly review draft",
    body: text,
    href: "/ai",
    dedupeKey: `ai:${kind}:${dayKey(now)}`,
  });

  if (delivered && kind === "brief" && prefs.morningBrief === "email") {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: "Your LifeOS morning brief",
        text,
        kind: "brief",
      });
    }
  }

  return { userId, kind, delivered, skipped: delivered ? "" : "already delivered today" };
}

/** One scheduled pass: brief for every opted-in user, review only on Fridays. */
export async function runProactive(now: Date = new Date()): Promise<ProactiveResult[]> {
  const results: ProactiveResult[] = [];
  for (const { userId, prefs } of await listProactiveUsers()) {
    if (prefs.morningBrief !== "off") {
      results.push(await deliverProactive(userId, "brief", now));
    }
    if (prefs.fridayReview && isFriday(now)) {
      results.push(await deliverProactive(userId, "review", now));
    }
  }
  return results;
}
