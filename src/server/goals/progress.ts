/**
 * Goal progress (spec §6.4). Pure functions so the arithmetic that dashboards and KPIs rely on
 * is testable without a database, and so every number on screen comes from one definition.
 */

export interface LinkedEntity {
  kind: "card" | "habit";
  done: boolean;
}

/** Percent of linked entities that are done; an empty link set is 0, not a divide-by-zero. */
export function linkedProgress(links: LinkedEntity[]): number {
  if (links.length === 0) return 0;
  const done = links.filter((link) => link.done).length;
  return clampPercent(Math.round((done / links.length) * 100));
}

export type KeyResultKind = "number" | "percent" | "linked";

export interface KeyResultShape {
  kind: string;
  current: number;
  target: number;
}

/**
 * A key result's progress. `percent` results are already 0–100; `number` results scale against
 * their target; `linked` results take the linked-entity percentage.
 */
export function keyResultProgress(keyResult: KeyResultShape, linked = 0): number {
  switch (keyResult.kind) {
    case "percent":
      return clampPercent(keyResult.current);
    case "linked":
      return clampPercent(linked);
    default:
      if (keyResult.target <= 0) return keyResult.current > 0 ? 100 : 0;
      return clampPercent(Math.round((keyResult.current / keyResult.target) * 100));
  }
}

/** An objective's progress is the mean of its key results (0 when it has none). */
export function goalProgress(parts: number[]): number {
  if (parts.length === 0) return 0;
  return clampPercent(Math.round(parts.reduce((total, part) => total + part, 0) / parts.length));
}

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));
