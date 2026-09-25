"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { logHealthAction } from "@/server/health/actions";

const field =
  "border border-border bg-background px-1.5 py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground";
const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

/** Values are logged in the unit the user chose; nothing is converted behind their back. */
export function HealthForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const t = useTranslations("Pages.Health");
  const [kind, setKind] = useState("sleep");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("h");
  const [date, setDate] = useState(defaultDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      method="post"
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
        {t("what")}
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={field}
          aria-label={t("ariaKind")}
        >
          {["sleep", "workout", "water", "mood", "weight"].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t("amount")}
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="8"
          className={`${field} w-20`}
          aria-label={t("ariaValue")}
        />
      </label>
      <label className={label}>
        {t("unit")}
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="h"
          className={`${field} w-20`}
          aria-label={t("ariaUnit")}
        />
      </label>
      <label className={label}>
        {t("day")}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={field}
          aria-label={t("ariaDate")}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || value.trim() === ""}>
        {t("logIt")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
