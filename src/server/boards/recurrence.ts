import { RRule } from "rrule";

/**
 * Recurrence (ADR-015): cards store an RRULE string; the service materialises the next
 * occurrence when a recurring card completes. Kept pure so the rule maths is unit-testable
 * without a database.
 */

/**
 * The next instant after `after`, or null when the rule has no further occurrence.
 *
 * The rule is re-anchored to `after` (the card's own due date) so a "daily 09:00" task keeps
 * its time-of-day instead of inheriting the moment the parser happened to build the rule. A
 * completion that lands after the next occurrence skips forward to the next future one, so
 * finishing late never spawns an already-overdue card.
 */
export function nextOccurrence(
  recurrence: string,
  after: Date,
  now: Date = new Date(),
): Date | null {
  try {
    const parsed = RRule.fromString(recurrence);
    const anchored = new RRule({ ...parsed.origOptions, dtstart: after });
    const next = anchored.after(after, false) ?? null;
    if (!next) return null;
    if (next.getTime() <= now.getTime()) return anchored.after(now, false) ?? next;
    return next;
  } catch {
    return null;
  }
}

/** Parses without throwing — used to reject bad RRULEs at the Zod boundary. */
export function isValidRecurrence(value: string): boolean {
  try {
    RRule.fromString(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Preserve the lead time between start and due when the next occurrence moves forward, so a
 * task with a two-day runway keeps it.
 */
export function shiftStart(start: Date | null, due: Date, next: Date): Date | null {
  if (!start) return null;
  return new Date(next.getTime() - (due.getTime() - new Date(start).getTime()));
}
