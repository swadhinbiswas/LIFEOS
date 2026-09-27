/**
 * Board view + card-face config (spec §5/§6.1). Kept as data so `boards.view_config` and
 * `boards.card_fields` are validated by Zod at the boundary and rendered by one `BoardView`.
 */

export const BOARD_VIEWS = ["kanban", "table", "calendar", "timeline", "grid"] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];

/**
 * The views the UI can actually draw (spec §6.1).
 *
 * `BOARD_VIEWS` is the full enum a board's config may hold; a view joins this list only when its
 * renderer exists, so the switcher never offers a control that opens nothing (spec §1 — no
 * placeholder UI). The keyboard map below is the same list in spec §4.3's `1`…`5` order.
 */
export const RENDERED_VIEWS: BoardView[] = ["kanban", "table", "grid", "calendar"];

/** Spec §4.3: `1`…`5` switch Table / Kanban / Grid / Calendar / Timeline. */
export const VIEW_KEYS: Partial<Record<BoardView, string>> = {
  table: "1",
  kanban: "2",
  grid: "3",
  calendar: "4",
  timeline: "5",
};

export interface ViewConfig {
  default: BoardView;
  views: BoardView[];
}

/** New boards and the system boards start with the two views that always exist. */
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
