"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createHabitAction, logHabitAction } from "@/server/habits/actions";

const field =
  "border border-border bg-background px-1.5 py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground";

/** Gentle by design: the only feedback is the streak going up (spec §6.4: never shame). */
export function HabitToggle({
  habitId,
  today,
  value,
  kind,
  step = 1,
}: {
  habitId: string;
  today: string;
  value: number;
  kind: "binary" | "numeric";
  step?: number;
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Habits");
  const [busy, setBusy] = useState(false);

  const log = async (next: number) => {
    setBusy(true);
    await logHabitAction({ habitId, date: today, value: next });
    setBusy(false);
    router.refresh();
  };

  if (kind === "binary") {
    return (
      <Button
        type="button"
        size="sm"
        variant={value > 0 ? "default" : "outline"}
        disabled={busy}
        aria-pressed={value > 0}
        onClick={() => void log(value > 0 ? 0 : 1)}
      >
        {value > 0 ? t("doneToday") : t("markDone")}
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void log(Math.max(0, value - step))}
        aria-label={t("oneLess")}
      >
        −
      </Button>
      <span className="w-8 text-center font-mono text-xs tabular-nums">{value}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void log(value + step)}
        aria-label={t("oneMore")}
      >
        +
      </Button>
    </span>
  );
}

export function AddHabitForm() {
  const router = useRouter();
  const t = useTranslations("Pages.Habits");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"binary" | "numeric">("binary");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      method="post"
      data-slot="add-habit"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={async (event) => {
        event.preventDefault();
        if (name.trim() === "") return;
        setBusy(true);
        setError("");
        const parsedTarget = target.trim() === "" ? null : Number.parseInt(target, 10);
        const result = await createHabitAction({
          name: name.trim(),
          kind,
          target: parsedTarget !== null && Number.isFinite(parsedTarget) ? parsedTarget : null,
          unit: unit.trim() === "" ? null : unit.trim(),
        });
        setBusy(false);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setName("");
        setTarget("");
        setUnit("");
        router.refresh();
      }}
    >
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("habit")}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("habitPlaceholder")}
          className={field}
          aria-label={t("ariaName")}
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("type")}
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as "binary" | "numeric")}
          className={field}
          aria-label={t("ariaType")}
        >
          <option value="binary">{t("yesNo")}</option>
          <option value="numeric">{t("number")}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("dailyTarget")}
        <input
          inputMode="numeric"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="8"
          className={`${field} w-20`}
          aria-label={t("ariaTarget")}
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("unit")}
        <input
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          placeholder={t("unitPlaceholder")}
          className={`${field} w-24`}
          aria-label={t("ariaUnit")}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || name.trim() === ""}>
        {busy ? t("adding") : t("addHabit")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
