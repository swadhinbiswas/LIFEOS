import type { DaySignals } from "@/server/day";

/**
 * What the last week looks like when you read the signals against each other (ADR-132).
 *
 * The review already knew "you did 40% of your habits". It could not say *why*, and the answer was
 * sitting in two other tables. This turns a list of counts into one or two sentences about a
 * relationship, which is the only form in which anybody changes a habit.
 */

/** Pearson's r. Two points, or one, have no correlation and are reported as none. */
export function correlation(pairs: Array<[number, number]>): number | null {
  if (pairs.length < 3) return null;
  const n = pairs.length;
  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / n;
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    const a = x - meanX;
    const b = y - meanY;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denominator = Math.sqrt(dx * dy);
  if (denominator === 0) return null;
  return num / denominator;
}

export interface DayCorrelation {
  /** Which two signals, as stable ids for the caller to turn into a sentence. */
  a: "sleepHours" | "mood";
  b: "mood" | "habitPct" | "focusMinutes";
  r: number;
  /** How many days both signals were recorded on. A correlation over three days is a rumour. */
  n: number;
}

export interface WeekInsight {
  sleep: number | null;
  mood: number | null;
  habitPct: number;
  focusMinutes: number;
  /** Recorded days per signal, so the caller can say "3 of 7 nights" rather than implying 7. */
  coverage: { sleep: number; mood: number; habits: number; focus: number };
  /** Non-empty only where there are enough overlapping days to mean anything. */
  correlations: DayCorrelation[];
  /** One sentence, already hedged to the evidence. Null when nothing correlates. */
  headline: string | null;
}

const MIN_DAYS = 4;

/**
 * Summarise a run, honestly.
 *
 * Every mean is over the days that were **recorded**, and the count comes with it. A seven-day sleep
 * average built from three nights is a number about three nights wearing a seven-day label, which is
 * exactly the kind of quiet fabrication this repo treats as a bug (spec §1).
 *
 * A correlation needs at least {@link MIN_DAYS} overlapping days and is reported with `n`. Below
 * that the sentence is omitted entirely rather than softened — "sleep doesn't seem to matter" is
 * advice, and advice from three data points is worse than no advice.
 */
export function summariseWeek(
  days: DaySignals[],
  names: { sleep: string; mood: string; habit: string; focus: string },
): WeekInsight {
  const sleepDays = days.filter((day) => day.sleepHours !== null);
  const moodDays = days.filter((day) => day.mood !== null);
  const habitDays = days.filter((day) => day.habitTotal > 0);
  const focusDays = days.filter((day) => day.focusMinutes > 0);

  const mean = (values: number[]): number | null =>
    values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

  const pairs = (
    pickA: (day: DaySignals) => number | null,
    pickB: (day: DaySignals) => number | null,
  ): Array<[number, number]> =>
    days
      .map((day) => [pickA(day), pickB(day)] as [number | null, number | null])
      .filter((pair): pair is [number, number] => pair[0] !== null && pair[1] !== null);

  const correlations: DayCorrelation[] = [];
  const add = (a: DayCorrelation["a"], b: DayCorrelation["b"], sample: Array<[number, number]>) => {
    if (sample.length < MIN_DAYS) return;
    const r = correlation(sample);
    if (r === null) return;
    correlations.push({ a, b, r, n: sample.length });
  };
  add(
    "sleepHours",
    "mood",
    pairs(
      (d) => d.sleepHours,
      (d) => d.mood,
    ),
  );
  add(
    "sleepHours",
    "habitPct",
    pairs(
      (d) => d.sleepHours,
      (d) => d.habitPct || null,
    ),
  );
  add(
    "mood",
    "habitPct",
    pairs(
      (d) => d.mood,
      (d) => d.habitPct || null,
    ),
  );

  // The strongest relationship, if there is one worth saying out loud.
  const strongest = correlations
    .filter((item) => Math.abs(item.r) >= 0.5)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];

  return {
    sleep: mean(sleepDays.map((day) => day.sleepHours!)),
    mood: mean(moodDays.map((day) => day.mood!)),
    habitPct: habitDays.length === 0 ? 0 : mean(habitDays.map((day) => day.habitPct))!,
    focusMinutes: focusDays.reduce((sum, day) => sum + day.focusMinutes, 0),
    coverage: {
      sleep: sleepDays.length,
      mood: moodDays.length,
      habits: habitDays.length,
      focus: focusDays.length,
    },
    correlations,
    headline: strongest ? phrase(strongest, names) : null,
  };
}

/**
 * One sentence about a relationship, naming the *signals*.
 *
 * It deliberately does not quote a representative value for either side. "More sleep (7h) went with
 * more habits" invents a 7h that nobody slept and a habit score that was never recorded — it reads
 * like a finding and is assembled from a correlation coefficient and two guesses. Naming the
 * signals and the number of days is the whole of what the data supports.
 */
function phrase(
  item: DayCorrelation,
  names: { sleep: string; mood: string; habit: string; focus: string },
): string {
  const name = (signal: DayCorrelation["a"] | DayCorrelation["b"]): string => {
    switch (signal) {
      case "sleepHours":
        return names.sleep;
      case "mood":
        return names.mood;
      case "habitPct":
        return names.habit;
      default:
        return names.focus;
    }
  };
  const [first, second] = item.r > 0 ? [item.a, item.b] : [item.b, item.a];
  return `More ${name(first)} went with more ${name(second)} (${item.n} days).`;
}
