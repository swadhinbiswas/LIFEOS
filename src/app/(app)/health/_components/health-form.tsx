"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { logHealthAction } from "@/server/health/actions";

const field =
  "border border-border bg-background px-1.5 py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground";
const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

/** Values are logged in the unit the user chose; nothing is converted behind their back. */
export function HealthForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("sleep");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("h");
  const [date, setDate] = useState(defaultDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      data-slot="add-health"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={async (event) => {
        event.preventDefault();
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return;
        setBusy(true);
        setError("");
        const result = await logHealthAction({
          kind,
          value: parsed,
          unit: unit.trim() === "" ? null : unit.trim(),
          date,
        });
        setBusy(false);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setValue("");
        router.refresh();
      }}
    >
      <label className={label}>
        what
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={field}
          aria-label="health kind"
        >
          {["sleep", "workout", "water", "mood", "weight"].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        amount
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="8"
          className={`${field} w-20`}
          aria-label="health value"
        />
      </label>
      <label className={label}>
        unit
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="h"
          className={`${field} w-20`}
          aria-label="health unit"
        />
      </label>
      <label className={label}>
        day
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={field}
          aria-label="health date"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || value.trim() === ""}>
        log it
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
