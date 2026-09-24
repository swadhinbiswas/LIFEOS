"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { setTimeZoneAction } from "@/server/settings/actions";

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

/**
 * Timezone preference (spec §6.9, ADR-057). The value is an IANA name; saving refreshes so every
 * day-bucketed surface re-reads it.
 */
export function TimeZoneForm({ current }: { current: string }) {
  const router = useRouter();
  const [timeZone, setTimeZone] = useState(current);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const options = COMMON.includes(current) ? COMMON : [current, ...COMMON];

  const save = async () => {
    setBusy(true);
    const result = await setTimeZoneAction({ timeZone });
    setBusy(false);
    setStatus(result.ok ? "saved" : (result.message ?? "could not save"));
    if (result.ok) router.refresh();
  };

  return (
    <div className="flex flex-wrap items-end gap-2 text-xs" data-slot="time-zone-form">
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || timeZone === current}
        onClick={() => void save()}
      >
        save timezone
      </Button>
      {status ? (
        <span
          role="status"
          data-slot="time-zone-status"
          className="font-mono text-[10px] text-muted-foreground"
        >
          {status}
        </span>
      ) : null}
    </div>
  );
}
