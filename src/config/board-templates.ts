/**
 * One-click board templates (spec §6.1) as pure data — the service seeds a board's columns
 * from here, so the Phase 8 template gallery needs no schema change or migration (ADR-042).
 */

export interface BoardTemplateColumn {
  name: string;
  /** Emoji/glyph chip on the column header. */
  glyph?: string;
  /** Dropping a card here completes it (sets `completed_at`). */
  isDone?: boolean;
  /** Soft WIP warning, never a hard block. */
  wipLimit?: number;
  /**
   * A **theme token name**, never a hex value — `primary`, `success`, `info`, `warning`, `accent`,
   * `secondary`, `destructive`, `muted-foreground`. A stored hex would freeze one theme's idea of
   * "green" into every other theme, and the whole point of the token layer is that a value names a
   * role rather than a colour.
   */
  color?: string;
  /**
   * How far through the work a card in this column is, 0-100 (ADR-128).
   *
   * **`null` is meaningful and is not the same as 0.** A terminal column that is an *outcome*
   * rather than a step — Rejected, Withdrawn — has no percentage, because "30% through" on an
   * application that was turned down is not a small number, it is a wrong one. A card sitting in
   * such a column reads as its outcome and no meter is drawn.
   */
  progressPct?: number | null;
}

export interface BoardTemplate {
  id: string;
  name: string;
  columns: BoardTemplateColumn[];
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "daily-kanban",
    name: "Daily Kanban",
    columns: [
      { name: "Backlog", glyph: "▤" },
      { name: "Today", glyph: "▸" },
      { name: "Doing", glyph: "◐", wipLimit: 3 },
      { name: "Done", glyph: "✓", isDone: true },
    ],
  },
  {
    id: "weekly-planner",
    name: "Weekly Planner",
    columns: [
      { name: "Monday" },
      { name: "Tuesday" },
      { name: "Wednesday" },
      { name: "Thursday" },
      { name: "Friday" },
      { name: "Done", isDone: true },
    ],
  },
  {
    id: "job-pipeline",
    name: "Job Pipeline",
    // The colours group the pipeline into phases rather than handing out ten unrelated hues: grey
    // before you have acted, cyan once it is out, purple through the conversation, green at the
    // offer, red for the outcomes. Adjacent stages sharing a token reads as deliberate; ten
    // distinct ones reads as a paint box. The weights are the same story in numbers — how much of
    // the work is genuinely behind you at each step.
    columns: [
      { name: "Wishlist", color: "muted-foreground", progressPct: 5 },
      { name: "Applied", color: "info", progressPct: 15 },
      { name: "Screening", color: "secondary", progressPct: 30 },
      { name: "Interview", color: "primary", progressPct: 50 },
      { name: "Technical", color: "primary", progressPct: 65 },
      { name: "Onsite/Final", color: "accent", progressPct: 80 },
      { name: "Offer", color: "success", progressPct: 92 },
      { name: "Accepted", color: "success", progressPct: 100, isDone: true },
      { name: "Rejected", color: "destructive", progressPct: null },
      { name: "Withdrawn", color: "muted-foreground", progressPct: null },
    ],
  },
  {
    id: "study-plan",
    name: "Study Plan",
    columns: [
      { name: "To learn" },
      { name: "Learning", wipLimit: 2 },
      { name: "Practising" },
      { name: "Mastered", isDone: true },
    ],
  },
  {
    id: "content-calendar",
    name: "Content Calendar",
    columns: [
      { name: "Ideas" },
      { name: "Drafting" },
      { name: "Review" },
      { name: "Scheduled" },
      { name: "Published", isDone: true },
    ],
  },
  {
    id: "bug-tracker",
    name: "Bug Tracker",
    columns: [
      { name: "Triage" },
      { name: "Confirmed" },
      { name: "Fixing", wipLimit: 2 },
      { name: "Verifying" },
      { name: "Closed", isDone: true },
    ],
  },
  {
    id: "project",
    name: "Project",
    columns: [
      { name: "Idea" },
      { name: "Spec" },
      { name: "Build", wipLimit: 3 },
      { name: "Ship", isDone: true },
    ],
  },
  {
    id: "reading-list",
    name: "Reading List",
    columns: [{ name: "Want to read" }, { name: "Reading" }, { name: "Finished", isDone: true }],
  },
  {
    id: "trip-planner",
    name: "Trip Planner",
    columns: [
      { name: "Ideas" },
      { name: "Booked" },
      { name: "Itinerary" },
      { name: "Travelled", isDone: true },
    ],
  },
  {
    id: "blank",
    name: "Blank",
    columns: [{ name: "To do" }, { name: "Done", isDone: true }],
  },
];

/**
 * The lazily created per-user Tasks board (ADR-042). Not in the gallery: it is the storage
 * behind `/tasks`, `/inbox` and the Today/Upcoming due-date views.
 */
export const SYSTEM_TASKS_TEMPLATE: BoardTemplate = {
  id: "system-tasks",
  name: "Tasks",
  columns: [
    { name: "Inbox", glyph: "▤" },
    { name: "Today", glyph: "▸" },
    { name: "Upcoming", glyph: "»" },
    { name: "Someday", glyph: "◇" },
    { name: "Done", glyph: "✓", isDone: true },
  ],
};

export function findBoardTemplate(id: string): BoardTemplate | undefined {
  return BOARD_TEMPLATES.find((template) => template.id === id);
}
