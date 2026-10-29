/**
 * The six fixed life dimensions (ADR-144). Order matters: it is the order shown in the UI and in
 * the review flow. A goal may support multiple dimensions through explicit connections.
 */
export const DIMENSIONS = [
  { id: "religion", label: "Religion & Spirituality" },
  { id: "health", label: "Health" },
  { id: "relationships", label: "Relationships & Family" },
  { id: "finance", label: "Finance" },
  { id: "self_growth", label: "Self Growth" },
  { id: "fun_rest", label: "Fun & Rest" },
] as const;

export type DimensionId = (typeof DIMENSIONS)[number]["id"];

export function isDimension(value: string): value is DimensionId {
  return DIMENSIONS.some((d) => d.id === value);
}
