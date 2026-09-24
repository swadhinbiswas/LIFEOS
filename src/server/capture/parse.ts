import * as chrono from "chrono-node";

/**
 * Quick-capture grammar (spec §4.3): `buy milk tomorrow 5pm #home !2` becomes a task with a
 * parsed due date, labels and priority. Parsing is server-side and pure (ADR-015) so there is
 * exactly one parser to test, and the client renders the returned preview — including which
 * tokens chrono matched — for click-to-correct.
 */

export type CapturePriority = "p0" | "p1" | "p2" | "p3";

export interface ParsedCapture {
  /** The text left after the structured tokens are removed. */
  title: string;
  dueAt: Date | null;
  priority: CapturePriority | null;
  /** `#tag` values, lower-cased, de-duplicated, in order of appearance. */
  tags: string[];
  /** What chrono consumed, for the preview ("tomorrow 5pm"). */
  matched: string[];
  /** Matched text that carried no explicit time (`friday`) — the click-to-correct cue. */
  uncertain: string[];
}

const PRIORITY_TOKEN = /(?:^|\s)!p?([0-3])(?=\s|$)/i;
const TAG_TOKEN = /(?:^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;

const stripSpan = (text: string, start: number, end: number): string =>
  `${text.slice(0, start)} ${text.slice(end)}`;

export function parseCapture(input: string, now: Date = new Date()): ParsedCapture {
  let working = input.trim();
  let priority: CapturePriority | null = null;
  const tags: string[] = [];

  const priorityMatch = PRIORITY_TOKEN.exec(working);
  if (priorityMatch) {
    priority = `p${priorityMatch[1]}` as CapturePriority;
    const [full] = priorityMatch;
    const start = priorityMatch.index + (full.startsWith(" ") ? 1 : 0);
    working = stripSpan(working, start, priorityMatch.index + full.length);
  }

  // Collect tag spans first (indices are relative to the current string), then strip them
  // from the end so earlier offsets stay valid.
  const tagSpans: Array<{ start: number; end: number; tag: string }> = [];
  for (const match of working.matchAll(TAG_TOKEN)) {
    const tag = match[1];
    const [full] = match;
    if (!tag) continue;
    const start = match.index + (full.startsWith(" ") ? 1 : 0);
    tagSpans.push({ start, end: match.index + full.length, tag });
  }
  for (const span of [...tagSpans].reverse()) {
    working = stripSpan(working, span.start, span.end);
  }
  for (const span of tagSpans) tags.push(span.tag.toLowerCase());

  const matched: string[] = [];
  const uncertain: string[] = [];
  let dueAt: Date | null = null;

  const results = chrono.casual.parse(working, now, { forwardDate: true });
  const first = results[0];
  if (first) {
    dueAt = first.start.date();
    matched.push(first.text);
    // A date without an explicit hour is the ambiguous case the preview highlights.
    if (!first.start.isCertain("hour")) uncertain.push(first.text);
    working = stripSpan(working, first.index, first.index + first.text.length);
  }

  const title = working.replace(/\s+/g, " ").trim();
  return { title, dueAt, priority, tags: [...new Set(tags)], matched, uncertain };
}
