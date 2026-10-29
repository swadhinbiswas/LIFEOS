"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { controlField } from "@/components/tui/controls";
import { createPlanAction } from "@/server/growth/actions";

const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

type Plan = {
  id: string;
  dimensionId: string;
  title: string;
  why: string | null;
  targetDate: string | null;
  status: string;
  goalIds: string[];
  habitIds: string[];
};

type Progress = {
  dimensionId: string;
  goalPct: number | null;
  habitPct: number | null;
  habitAvailable: boolean;
  goals: number;
  habits: number;
  completed: number;
  eligible: number;
};

export function GrowthView({
  plans: initialPlans,
  progress,
}: {
  plans: Plan[];
  progress: Progress[];
}) {
  const [plans] = useState(initialPlans);
  const [showForm, setShowForm] = useState(false);
  const [dimensionId, setDimensionId] = useState("health");
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setBusy(true);
    setError("");
    const result = await createPlanAction({
      dimensionId,
      title: title.trim(),
      why: why.trim() || null,
      targetDate: targetDate || null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "failed");
      return;
    }
    setShowForm(false);
    setTitle("");
    setWhy("");
    setTargetDate("");
    window.location.reload();
  };

  const byDim = new Map<string, Plan[]>();
  for (const p of plans) {
    const arr = byDim.get(p.dimensionId) ?? [];
    arr.push(p);
    byDim.set(p.dimensionId, arr);
  }
  const progressByDim = new Map(progress.map((p) => [p.dimensionId, p]));

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "cancel" : "new long-term goal"}
        </Button>
      </div>

      {showForm ? (
        <div className="flex flex-col gap-2 border border-border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className={label}>
              dimension
              <select
                value={dimensionId}
                onChange={(e) => setDimensionId(e.target.value)}
                className={controlField}
              >
                {["religion", "health", "relationships", "finance", "self_growth", "fun_rest"].map(
                  (d) => (
                    <option key={d} value={d}>
                      {d.replace("_", " ")}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className={`${label} min-w-40 flex-1`}>
              title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={controlField}
              />
            </label>
            <label className={`${label} min-w-40 flex-1`}>
              why
              <input
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                className={controlField}
              />
            </label>
            <label className={label}>
              target date
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className={controlField}
              />
            </label>
          </div>
          <Button size="sm" disabled={busy || !title.trim()} onClick={() => void create()}>
            {busy ? "…" : "create"}
          </Button>
          {error ? (
            <span role="alert" className="text-destructive">
              {error}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {["religion", "health", "relationships", "finance", "self_growth", "fun_rest"].map(
          (dim) => {
            const p = progressByDim.get(dim);
            const ps = byDim.get(dim) ?? [];
            return (
              <div key={dim} className="border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold capitalize">
                    {dim.replace("_", " ")}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {p ? `goals ${p.goalPct ?? "—"}% · habits ${p.habitPct ?? "—"}%` : "—"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {ps.length} plan{ps.length === 1 ? "" : "s"}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {ps.map((plan) => (
                    <li key={plan.id} className="font-mono text-xs">
                      {plan.title} <span className="text-muted-foreground">({plan.status})</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
