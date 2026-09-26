import { getTranslations } from "next-intl/server";

import { AsciiMeter } from "@/components/tui/ascii-meter";
import type { DaySignals } from "@/server/day";

/**
 * "How was today", on one row (ADR-132).
 *
 * Five numbers that already exist on four other pages, side by side for the first time. The value
 * is not any single one of them — it is that `4h sleep · mood 2 · 40% habits · 45 min · €12` is a
 * *diagnosis*, while "you did 40% of your habits" is only a number. You cannot act on the first
 * sentence you read either, but you can act on the second one, and you can only get there by
 * opening four routes and subtracting in your head.
 *
 * **Unrecorded is a first-class state, drawn as `—` and never as zero.** The whole point of the
 * row is to tell you which of your signals are missing, and a `0h` or a `mood 0` would be a
 * fabricated reading that also destroyed the information you came for. `recorded` drives a small
 * completeness marker at the end for the same reason.
 */
export async function DaySignalsStrip({ signals }: { signals: DaySignals }) {
  const t = await getTranslations("Pages.Dashboard");

  const money =
    signals.spentMinor > 0 && signals.currency
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: signals.currency,
          maximumFractionDigits: 0,
        }).format(signals.spentMinor / 100)
      : null;

  const items = [
    {
      id: "sleep",
      label: t("signalSleep"),
      // Hours as logged. The health service never converts units, and neither does this.
      value: signals.sleepHours === null ? "—" : `${signals.sleepHours}h`,
      tone: tone(signals.sleepHours, 5),
    },
    {
      id: "mood",
      label: t("signalMood"),
      value: signals.mood === null ? "—" : `${signals.mood}/5`,
      tone: tone(signals.mood, 3),
    },
    {
      id: "habits",
      label: t("signalHabits"),
      value:
        signals.habitTotal === 0
          ? t("signalNoHabits")
          : `${signals.habitDone}/${signals.habitTotal}`,
      tone: signals.habitTotal === 0 ? "muted" : signals.habitPct >= 100 ? "good" : "flat",
    },
    {
      id: "focus",
      label: t("signalFocus"),
      value: signals.focusMinutes === 0 ? "0m" : `${signals.focusMinutes}m`,
      tone: signals.focusMinutes > 0 ? "good" : "muted",
    },
    {
      id: "spend",
      label: t("signalSpend"),
      value: money ?? (signals.spentMinor === 0 ? t("signalNone") : "—"),
      tone: signals.spentMinor > 0 ? "flat" : "muted",
    },
  ];

  return (
    <div className="grid gap-2" data-slot="day-signals">
      <ul className="flex flex-wrap items-stretch gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            data-slot="day-signal"
            data-tone={item.tone}
            className="flex min-w-24 flex-1 flex-col gap-0.5 rounded-[var(--radius)] border border-border px-2 py-1.5"
          >
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              {item.label}
            </span>
            <span className="font-mono text-sm tabular-nums">{item.value}</span>
          </li>
        ))}
      </ul>

      {/* Habits get a meter as well as a count, because "2/3" and "67%" are the same fact and the
          proportion is the one you can compare against yesterday's at a glance. Everything else is
          a single value where a proportion would be invented. */}
      {signals.habitTotal > 0 ? (
        <div className="flex items-center gap-2">
          <AsciiMeter
            value={signals.habitPct / 100}
            label={t("signalHabitsMeter", { pct: signals.habitPct })}
            cells={20}
            showValue={false}
            className="text-[10px]"
          />
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {t("signalHabitsPct", { pct: signals.habitPct })}
          </span>
        </div>
      ) : null}

      <p className="font-mono text-[10px] text-muted-foreground" data-slot="signal-coverage">
        {/* Which signals are still blank, by name. This is the actionable half of the row: it is the
            difference between "my day was bad" and "I never recorded my mood this week". */}
        {signals.recorded >= 4
          ? t("signalCoverageFull", { count: signals.recorded })
          : t("signalCoveragePartial", { count: signals.recorded, total: 5 })}
      </p>
    </div>
  );
}

/**
 * Tone by value, with the thresholds in one place.
 *
 * These are tints for scanning, not verdicts. A mood of 2 is not a "danger", it is a Tuesday, and
 * colouring it red would be the app telling you how to feel about your own week. Only the extremes
 * get called out, and the sleep threshold is deliberately crude because nobody measured this: under
 * five hours is short by any reading, over five is not.
 */
function tone(value: number | null, limit: number): "good" | "flat" | "warn" | "muted" {
  if (value === null) return "muted";
  if (value === 0) return "flat";
  return value < limit ? "warn" : "good";
}
