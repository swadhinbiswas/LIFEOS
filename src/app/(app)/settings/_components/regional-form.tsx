"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { setTimeZoneAction, setWeekStartAction } from "@/server/settings/actions";

/** A short list of common zones; the saved value is always available even if it is not in it. */
const COMMON = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Africa/Lagos",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Tokyo",
  "Australia/Sydney",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
];

const WEEK_STARTS = [
  { value: "mon", label: "Monday" },
  { value: "sun", label: "Sunday" },
] as const;

/**
 * Regional preference (spec §6.9, ADR-057/058): the timezone every day is bucketed in and the day
 * the week starts on. Both save together; a refresh re-reads them everywhere.
 */
export function RegionalForm({
  timeZone: initialZone,
  weekStart: initialWeekStart,
}: {
  timeZone: string;
  weekStart: "mon" | "sun";
}) {
  const router = useRouter();
  const [timeZone, setTimeZone] = useState(initialZone);
  const [weekStart, setWeekStart] = useState<"mon" | "sun">(initialWeekStart);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const options = COMMON.includes(initialZone) ? COMMON : [initialZone, ...COMMON];
  const dirty = timeZone !== initialZone || weekStart !== initialWeekStart;

  const save = async () => {
    setBusy(true);
    const [tz, ws] = await Promise.all([
      setTimeZoneAction({ timeZone }),
      setWeekStartAction({ weekStart }),
    ]);
    setBusy(false);
    const ok = tz.ok && ws.ok;
    setStatus(ok ? "saved" : (tz.message ?? ws.message ?? "could not save"));
    if (ok) router.refresh();
  };

  return (
    <div className="flex flex-wrap items-end gap-2 text-xs" data-slot="regional-form">
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        timezone
        <select
          value={timeZone}
          onChange={(event) => setTimeZone(event.target.value)}
          className="h-8 border border-border bg-background px-2 font-mono text-xs"
          aria-label="timezone"
        >
          {options.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        week starts
        <select
          value={weekStart}
          onChange={(event) => setWeekStart(event.target.value as "mon" | "sun")}
          className="h-8 border border-border bg-background px-2 font-mono text-xs"
          aria-label="week starts"
        >
          {WEEK_STARTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !dirty}
        onClick={() => void save()}
      >
        save regional
      </Button>
      {status ? (
        <span
          role="status"
          data-slot="regional-status"
          className="font-mono text-[10px] text-muted-foreground"
        >
          {status}
        </span>
      ) : null}
    </div>
  );
}
