"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { controlField } from "@/components/tui/controls";
import {
  createGoalAction,
  createKeyResultAction,
  setKeyResultValueAction,
  updateGoalAction,
} from "@/server/goals/actions";

const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

function useSubmit() {
  const router = useRouter();
  const t = useTranslations("Pages.Goals");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (
    call: () => Promise<{ ok: boolean; message?: string }>,
    reset?: () => void,
  ) => {
    setBusy(true);
    setError("");
    const result = await call();
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? t("couldNotSave"));
      return;
    }
    reset?.();
    router.refresh();
  };
  return { busy, error, submit };
}

export function AddGoalForm() {
  const t = useTranslations("Pages.Goals");
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("2026-Q4");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      method="post"
      data-slot="add-goal"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() === "") return;
        void submit(
          () => createGoalAction({ title: title.trim(), period: period.trim() || null }),
          () => setTitle(""),
        );
      }}
    >
      <label className={`${label} min-w-64 flex-1`}>
        {t("objective")}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("objectivePlaceholder")}
          className={controlField}
          aria-label={t("ariaObjective")}
        />
      </label>
      <label className={label}>
        {t("cycle")}
        <input
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          placeholder="2026-Q4"
          className={`${controlField} w-28`}
          aria-label={t("ariaCycle")}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || title.trim() === ""}>
        {busy ? t("adding") : t("addObjective")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

export function AddKeyResultForm({ goalId }: { goalId: string }) {
  const t = useTranslations("Pages.Goals");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"number" | "percent" | "linked">("number");
  const [target, setTarget] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      method="post"
      data-slot="add-key-result"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() === "") return;
        const parsed = kind === "linked" ? 0 : Number.parseInt(target, 10);
        void submit(
          () =>
            createKeyResultAction({
              goalId,
              title: title.trim(),
              kind,
              target: Number.isFinite(parsed) ? (parsed as number) : 0,
            }),
          () => {
            setTitle("");
            setTarget("");
          },
        );
      }}
    >
      <label className={`${label} min-w-56 flex-1`}>
        {t("keyResult")}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("keyResultPlaceholder")}
          className={controlField}
          aria-label={t("ariaKeyResult")}
        />
      </label>
      <label className={label}>
        {t("measure")}
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as "number" | "percent" | "linked")}
          className={controlField}
          aria-label={t("ariaMeasure")}
        >
          <option value="number">{t("number")}</option>
          <option value="percent">{t("percent")}</option>
          <option value="linked">{t("linkedWork")}</option>
        </select>
      </label>
      {kind !== "linked" ? (
        <label className={label}>
          {t("target")}
          <input
            inputMode="numeric"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={kind === "percent" ? "100" : "4"}
            className={`${controlField} w-20`}
            aria-label={t("ariaTarget")}
          />
        </label>
      ) : null}
      <Button type="submit" size="sm" variant="outline" disabled={busy || title.trim() === ""}>
        {busy ? t("adding") : t("addResult")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

export function KeyResultControls({
  keyResultId,
  current,
  kind,
}: {
  keyResultId: string;
  current: number;
  kind: string;
}) {
  const t = useTranslations("Pages.Goals");
  const { busy, submit } = useSubmit();
  if (kind === "linked") return null;

  const set = (next: number) =>
    void submit(() => setKeyResultValueAction({ keyResultId, current: Math.max(0, next) }));

  return (
    <span className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => set(current - 1)}
        aria-label={t("decrease")}
      >
        −
      </Button>
      <span className="w-10 text-center font-mono text-xs tabular-nums">{current}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => set(current + 1)}
        aria-label={t("increase")}
      >
        +
      </Button>
    </span>
  );
}

export function GoalStatusButton({ goalId, status }: { goalId: string; status: string }) {
  const t = useTranslations("Pages.Goals");
  const { busy, submit } = useSubmit();
  const next = status === "active" ? "done" : "active";

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() => void submit(() => updateGoalAction({ goalId, status: next }))}
    >
      {status === "active" ? t("markAchieved") : t("reopen")}
    </Button>
  );
}
