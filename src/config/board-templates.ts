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
    columns: [
      { name: "Wishlist" },
      { name: "Applied" },
      { name: "Screening" },
      { name: "Interview" },
      { name: "Technical" },
      { name: "Onsite/Final" },
      { name: "Offer" },
      { name: "Accepted", isDone: true },
      { name: "Rejected" },
      { name: "Withdrawn" },
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
