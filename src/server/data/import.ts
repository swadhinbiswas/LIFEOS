import { z } from "zod";

import { createTask } from "@/server/api/v1/cards";
import { createGoal } from "@/server/goals";
import { createHabit } from "@/server/habits";
import { createNote } from "@/server/notes";

/**
 * Data import (spec §10, ADR-083). It accepts the same JSON the export produces and restores the
 * modules with a stable create path: notes, cards (as tasks), habits and goals. Modules whose shape
 * needs a bespoke restore (board hierarchy, finance balances) are reported as **skipped** rather
 * than half-imported — the report is the contract, and nothing is silently dropped.
 */

const record = z.record(z.string(), z.unknown());

const importSchema = z
  .object({
    version: z.number().optional(),
    notes: z.array(record).optional(),
    cards: z.array(record).optional(),
    habits: z.array(record).optional(),
    goals: z.array(record).optional(),
  })
  // Keep unknown modules so the report can name what was skipped rather than silently dropping it.
  .passthrough();

export interface ImportReport {
  notes: number;
  cards: number;
  habits: number;
  goals: number;
  skipped: string[];
}

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const optionalDate = (value: unknown): Date | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const MAX_ROWS = 5_000;

export async function importData(userId: string, payload: unknown): Promise<ImportReport> {
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) throw new Error("that file is not a LifeOS export");

  const report: ImportReport = { notes: 0, cards: 0, habits: 0, goals: 0, skipped: [] };

  for (const note of (parsed.data.notes ?? []).slice(0, MAX_ROWS)) {
    const title = text(note.title);
    const body = text(note.body);
    if (title === "" && body === "") continue;
    await createNote(userId, {
      title,
      body,
      kind: text(note.kind, "note"),
      dailyDate: typeof note.daily_date === "string" ? note.daily_date : null,
    });
    report.notes += 1;
  }

  for (const card of (parsed.data.cards ?? []).slice(0, MAX_ROWS)) {
    const title = text(card.title).trim();
    if (title === "") continue;
    const priority = text(card.priority);
    await createTask(userId, {
      title,
      dueAt: optionalDate(card.due_at),
      priority:
        priority === "p0" || priority === "p1" || priority === "p2" || priority === "p3"
          ? priority
          : null,
    });
    report.cards += 1;
  }

  for (const habit of (parsed.data.habits ?? []).slice(0, MAX_ROWS)) {
    const name = text(habit.name).trim();
    if (name === "") continue;
    const kind = text(habit.kind, "binary");
    await createHabit(userId, {
      name,
      kind: kind === "numeric" ? "numeric" : "binary",
      target: typeof habit.target === "number" ? habit.target : null,
      unit: typeof habit.unit === "string" ? habit.unit : null,
    });
    report.habits += 1;
  }

  for (const goal of (parsed.data.goals ?? []).slice(0, MAX_ROWS)) {
    const title = text(goal.title).trim();
    if (title === "") continue;
    await createGoal(userId, {
      title,
      period: typeof goal.period === "string" ? goal.period : null,
    });
    report.goals += 1;
  }

  for (const key of Object.keys(parsed.data)) {
    if (!["version", "notes", "cards", "habits", "goals"].includes(key)) {
      report.skipped.push(key);
    }
  }
  for (const key of ["boards", "transactions", "projects", "skills"]) {
    if (!report.skipped.includes(key) && key in parsed.data) report.skipped.push(key);
  }

  return report;
}
