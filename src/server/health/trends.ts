/**
 * Health trends (spec §6.6). Pure over day-keyed logs, so "this week vs last week" is a testable
 * claim rather than a chart that nobody can check. Values are stored exactly as the user entered
 * them with their own unit — no hidden conversions between glasses, hours and kilograms.
 */

export interface HealthLogLike {
  kind: string;
  value: number;
  unit: string | null;
  /** `YYYY-MM-DD` in the user's terms (ADR-045). */
  date: string;
}

export interface KindTrend {
  kind: string;
  unit: string | null;
  /** Mean of the window, or null when nothing was logged. */
  average: number | null;
  /** Mean of the most recent 7 days. */
  thisWeek: number | null;
  /** Mean of the 7 days before that. */
  lastWeek: number | null;
  /** thisWeek - lastWeek when both exist, else null. */
  delta: number | null;
  entries: number;
}

const mean = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((values.reduce((total, v) => total + v, 0) / values.length) * 10) / 10;

/** The last `days` day keys ending today, computed on the keys (never on instants). */
export function windowDays(today: string, days: number): string[] {
  const keys: string[] = [];
  const [year, month, day] = today.split("-").map(Number);
  const cursor = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  for (let index = 0; index < days; index += 1) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return keys.reverse();
}

/**
 * Per-kind averages over a window plus a week-over-week delta. The window is split by position in
 * the day list rather than by parsing dates again, so the two "weeks" are exactly 7 days each.
 */
export function kindTrends(logs: HealthLogLike[], today: string, windowSize = 28): KindTrend[] {
  const window = windowDays(today, windowSize);
  const inWindow = new Set(window);
  const lastWeek = new Set(window.slice(-7));
  const previousWeek = new Set(window.slice(-14, -7));

  const byKind = new Map<string, HealthLogLike[]>();
  for (const log of logs) {
    if (!inWindow.has(log.date)) continue;
    const bucket = byKind.get(log.kind) ?? [];
    bucket.push(log);
    byKind.set(log.kind, bucket);
  }

  return [...byKind.entries()]
    .map(([kind, entries]) => {
      const thisWeek = mean(
        entries.filter((entry) => lastWeek.has(entry.date)).map((e) => e.value),
      );
      const prior = mean(
        entries.filter((entry) => previousWeek.has(entry.date)).map((e) => e.value),
      );
      return {
        kind,
        unit: entries[0]?.unit ?? null,
        average: mean(entries.map((entry) => entry.value)),
        thisWeek,
        lastWeek: prior,
        delta:
          thisWeek !== null && prior !== null ? Math.round((thisWeek - prior) * 10) / 10 : null,
        entries: entries.length,
      };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind));
}
