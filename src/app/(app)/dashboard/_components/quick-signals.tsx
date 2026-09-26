"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "cn";
import { logDaySignalAction } from "@/server/day/actions";

/**
 * Sleep and mood, one tap each, on the page you already open (ADR-132).
 *
 * Both were already modelled and both lived behind a form on `/health` — a dropdown, a number
 * input and a submit. That is a perfectly reasonable UI and a completely unreliable habit: the
 * friction is the whole reason a signal you care about stops being recorded, and a signal you do
 * not record cannot be correlated with anything. Four taps on the dashboard is the difference between
 * a week of sleep data and three data points.
 *
 * **Mood is five buttons, not a scale of one to five with a slider.** Tapping "2" has to be one
 * gesture; a drag is two, and precision is not wanted here. The values are the 1–5 the health log
 * already uses, so nothing is invented and nothing needs converting.
 *
 * **Sleep stays a number.** "5", "6", "7" and "8" are the answers almost everyone gives, and a
 * five-button row of hours would be a worse control than four keys. It is a select for that reason,
 * with an explicit "—" for *not recorded*, which is different from zero hours.
 */
export function QuickSignals({
  sleepHours,
  mood,
  disabled = false,
}: {
  sleepHours: number | null;
  mood: number | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Dashboard");
  const [busy, setBusy] = useState<string | null>(null);

  const record = async (kind: "sleep" | "mood", value: number) => {
    setBusy(kind);
    await logDaySignalAction({ kind, value });
    setBusy(null);
    router.refresh();
  };

  return (
    <div className="grid gap-2" data-slot="quick-signals">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          {t("signalSleep")}
        </span>
        <label className="flex items-center gap-1">
          <span className="sr-only">{t("signalSleepPick")}</span>
          <select
            aria-label={t("signalSleepPick")}
            disabled={disabled || busy !== null}
            value={sleepHours === null ? "" : String(sleepHours)}
            onChange={(event) => {
              const next = event.target.value;
              if (next === "") return;
              void record("sleep", Number(next));
            }}
            className="min-h-7 rounded-[var(--radius)] border border-border bg-background px-2 font-mono text-xs focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {/* The empty option is "not recorded" and is not selectable to — it is what the control
             *shows* when nothing is logged, so the state is visible rather than implied by a
             * placeholder that disappears the moment you focus it. */}
            <option value="">{t("signalUnrecorded")}</option>
            {[4, 5, 6, 7, 8, 9].map((hours) => (
              <option key={hours} value={hours}>
                {hours}h
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          {t("signalMood")}
        </span>
        <div role="group" aria-label={t("signalMoodPick")} className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => {
            const active = mood === value;
            return (
              <button
                key={value}
                type="button"
                disabled={disabled || busy !== null}
                aria-pressed={active}
                onClick={() => void record("mood", value)}
                className={cn(
                  "min-h-7 min-w-7 rounded-[var(--radius)] border px-1.5 font-mono text-xs tabular-nums",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                  (disabled || busy !== null) && "opacity-60",
                )}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
