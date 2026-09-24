/**
 * Board view + card-face config (spec §5/§6.1). Kept as data so `boards.view_config` and
 * `boards.card_fields` are validated by Zod at the boundary and rendered by one `BoardView`.
 */

export const BOARD_VIEWS = ["kanban", "table", "calendar", "timeline", "grid"] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];

export interface ViewConfig {
  default: BoardView;
  views: BoardView[];
}

/** Phase 2 ships kanban + table; calendar/timeline/grid flip on when their renderers land. */
export const DEFAULT_VIEW_CONFIG: ViewConfig = { default: "kanban", views: ["kanban", "table"] };

export const CARD_FACE_FIELDS = [
  "priority",
  "labels",
  "dueAt",
  "checklist",
  "estimate",
  "assignee",
] as const;
export type CardFaceField = (typeof CARD_FACE_FIELDS)[number];

export const DEFAULT_CARD_FIELDS: CardFaceField[] = ["priority", "dueAt", "checklist"];
