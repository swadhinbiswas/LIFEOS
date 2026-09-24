"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createGoalAction,
  createKeyResultAction,
  setKeyResultValueAction,
  updateGoalAction,
} from "@/server/goals/actions";

const field =
  "border border-border bg-background px-1.5 py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground";
const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

function useSubmit() {
  const router = useRouter();
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
      setError(result.message ?? "could not save");
      return;
    }
    reset?.();
    router.refresh();
  };
  return { busy, error, submit };
}

export function AddGoalForm() {
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("2026-Q4");
  const { busy, error, submit } = useSubmit();

  return (
    <form
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
        objective
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="ship the career module properly"
          className={field}
          aria-label="objective"
        />
      </label>
      <label className={label}>
        cycle
        <input
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          placeholder="2026-Q4"
          className={`${field} w-28`}
          aria-label="goal cycle"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || title.trim() === ""}>
        {busy ? "adding…" : "add objective"}
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
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"number" | "percent" | "linked">("number");
  const [target, setTarget] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
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
        key result
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="publish 4 case studies"
          className={field}
          aria-label="key result"
        />
      </label>
      <label className={label}>
        measure
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as "number" | "percent" | "linked")}
          className={field}
          aria-label="key result measure"
        >
          <option value="number">number</option>
          <option value="percent">percent</option>
          <option value="linked">linked work</option>
        </select>
      </label>
      {kind !== "linked" ? (
        <label className={label}>
          target
          <input
            inputMode="numeric"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={kind === "percent" ? "100" : "4"}
            className={`${field} w-20`}
            aria-label="key result target"
          />
        </label>
      ) : null}
      <Button type="submit" size="sm" variant="outline" disabled={busy || title.trim() === ""}>
        {busy ? "adding…" : "add result"}
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
        aria-label="decrease"
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
        aria-label="increase"
      >
        +
      </Button>
    </span>
  );
}

export function GoalStatusButton({ goalId, status }: { goalId: string; status: string }) {
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
      {status === "active" ? "mark achieved" : "reopen"}
    </Button>
  );
}
