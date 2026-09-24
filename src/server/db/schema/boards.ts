import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { users } from "./identity";

/**
 * Boards engine (ERD §2.2, spec §6.1). One board serves Tasks, custom boards and (Phase 3)
 * the job pipeline — every row here is `kind`-agnostic.
 *
 * Conventions (ERD §0): ULID text ids, integer-ms UTC timestamps, soft delete via `deleted_at`,
 * `user_id` on every user-owned row so the service can scope every query (spec line 350 /
 * ADR-026). Ordering columns are fractional-index TEXT (ADR-009) — byte-compared in SQL, never
 * `localeCompare` in JS. `cards.version` is the ADR-011 optimistic-concurrency token.
 *
 * The unique position indexes are **partial on `deleted_at IS NULL`**: a trashed card keeps its
 * key so a restore needs no rewrite, and it can never block a live insert. That is the ADR-009
 * UNIQUE + retry contract, narrowed to live rows.
 */

/** Fresh timestamp builders per table — a column builder must not be shared across tables. */
const timestamps = () => ({
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const boards = sqliteTable(
  "boards",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Reserved for teams (spec line 350) — null today. */
    workspace_id: text("workspace_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** Seed template id from `config/board-templates.ts`; null for a blank board. */
    template: text("template"),
    /** Default view + enabled views as JSON (spec §5 `?view=`). */
    view_config: text("view_config"),
    /** Which card fields the card face shows, as JSON (spec §6.1). */
    card_fields: text("card_fields"),
    /** The lazily created per-user Tasks board (ADR-042). */
    is_system: integer("is_system", { mode: "boolean" }).notNull().default(false),
    archived_at: integer("archived_at", { mode: "timestamp_ms" }),
    deleted_at: integer("deleted_at", { mode: "timestamp_ms" }),
    is_demo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    index("boards_user_id_idx").on(t.user_id),
    uniqueIndex("boards_user_slug_unq").on(t.user_id, t.slug),
  ],
);

export const board_columns = sqliteTable(
  "board_columns",
  {
    id: text("id").primaryKey(),
    board_id: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspace_id: text("workspace_id"),
    name: text("name").notNull(),
    color: text("color"),
    /** Emoji/glyph chip on the column header (spec §6.1). */
    glyph: text("glyph"),
    /** Fractional index (ADR-009). */
    position: text("position").notNull(),
    /** Soft WIP warning, not a hard block (spec §6.1) — null hides the meter. */
    wip_limit: integer("wip_limit"),
    /** Dropping a card here completes it and sets `completed_at`. */
    is_done: integer("is_done", { mode: "boolean" }).notNull().default(false),
    /** Column visibility/state as JSON (collapsed, etc.). */
    meta: text("meta"),
    ...timestamps(),
  },
  (t) => [
    index("board_columns_board_idx").on(t.board_id, t.position),
    uniqueIndex("board_columns_position_unq").on(t.board_id, t.position),
  ],
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    board_id: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    column_id: text("column_id")
      .notNull()
      .references(() => board_columns.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspace_id: text("workspace_id"),
    /** Fractional index within the column (ADR-009). */
    position: text("position").notNull(),
    title: text("title").notNull(),
    /** Markdown, sanitized at render (spec §10). */
    description: text("description"),
    /** `p0`–`p3` or null (spec §6.1). */
    priority: text("priority"),
    due_at: integer("due_at", { mode: "timestamp_ms" }),
    start_at: integer("start_at", { mode: "timestamp_ms" }),
    estimate_min: integer("estimate_min"),
    completed_at: integer("completed_at", { mode: "timestamp_ms" }),
    archived_at: integer("archived_at", { mode: "timestamp_ms" }),
    /** Trash (spec §6.1: 30-day soft delete). */
    deleted_at: integer("deleted_at", { mode: "timestamp_ms" }),
    /** RRULE string (ADR-015) or null for one-shot tasks. */
    recurrence: text("recurrence"),
    /** `task` | `job` | `generic` (spec §7.3). */
    kind: text("kind").notNull().default("task"),
    /** Kind-specific payload as JSON (job fields later, cover colour, etc.). */
    meta: text("meta"),
    /** ADR-011 optimistic-concurrency token; every write checks it. */
    version: integer("version").notNull().default(1),
    is_demo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    index("cards_board_column_position_idx").on(t.board_id, t.column_id, t.position),
    index("cards_user_due_idx").on(t.user_id, t.due_at),
    index("cards_user_updated_idx").on(t.user_id, t.updated_at),
    uniqueIndex("cards_column_position_unq")
      .on(t.column_id, t.position)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const labels = sqliteTable(
  "labels",
  {
    id: text("id").primaryKey(),
    board_id: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("labels_board_name_unq").on(t.board_id, t.name)],
);

export const card_labels = sqliteTable(
  "card_labels",
  {
    card_id: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    label_id: text("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.card_id, t.label_id] })],
);

export const checklists = sqliteTable(
  "checklists",
  {
    id: text("id").primaryKey(),
    card_id: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: text("position").notNull(),
    ...timestamps(),
  },
  (t) => [index("checklists_card_idx").on(t.card_id, t.position)],
);

export const checklist_items = sqliteTable(
  "checklist_items",
  {
    id: text("id").primaryKey(),
    checklist_id: text("checklist_id")
      .notNull()
      .references(() => checklists.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    done_at: integer("done_at", { mode: "timestamp_ms" }),
    position: text("position").notNull(),
    ...timestamps(),
  },
  (t) => [index("checklist_items_checklist_idx").on(t.checklist_id, t.position)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    card_id: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Markdown, sanitized at render (spec §10). */
    body: text("body").notNull(),
    /** Actor label for the activity log (`user` today; future AI/agent actors). */
    actor: text("actor").notNull().default("user"),
    ...timestamps(),
  },
  (t) => [index("comments_card_idx").on(t.card_id, t.created_at)],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    card_id: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `link` | `file` — links-only is acceptable v1 (spec §7 files row). */
    kind: text("kind").notNull().default("link"),
    url: text("url"),
    storage_key: text("storage_key"),
    name: text("name"),
    size: integer("size"),
    ...timestamps(),
  },
  (t) => [index("attachments_card_idx").on(t.card_id)],
);

export const custom_fields = sqliteTable(
  "custom_fields",
  {
    id: text("id").primaryKey(),
    board_id: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    /** `text` | `number` | `date` | `select` | `bool` (ERD §2.2). */
    type: text("type").notNull(),
    /** Choices for `select`, as JSON. */
    options: text("options"),
    position: text("position").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("custom_fields_board_key_unq").on(t.board_id, t.key)],
);

export const custom_field_values = sqliteTable(
  "custom_field_values",
  {
    card_id: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    field_id: text("field_id")
      .notNull()
      .references(() => custom_fields.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Always TEXT; typed at the Zod boundary (ERD §2.2). */
    value: text("value"),
  },
  (t) => [primaryKey({ columns: [t.card_id, t.field_id] })],
);

export const card_links = sqliteTable(
  "card_links",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    src_type: text("src_type").notNull(),
    src_id: text("src_id").notNull(),
    dst_type: text("dst_type").notNull(),
    dst_id: text("dst_id").notNull(),
    /** `relates` | `blocks` | `duplicates` (ERD §2.2). */
    link_kind: text("link_kind").notNull().default("relates"),
    ...timestamps(),
  },
  (t) => [
    index("card_links_src_idx").on(t.user_id, t.src_type, t.src_id),
    index("card_links_dst_idx").on(t.user_id, t.dst_type, t.dst_id),
  ],
);

export const saved_views = sqliteTable(
  "saved_views",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `tasks` | `jobs` | `board` (spec §5 `?filter=` scopes). */
    scope: text("scope").notNull(),
    name: text("name").notNull(),
    /** Filter/sort/group payload as JSON, validated by the shared Zod schema. */
    query: text("query").notNull(),
    /** Reserved for shared views (ERD §2.2). */
    shared: integer("shared", { mode: "boolean" }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [index("saved_views_user_scope_idx").on(t.user_id, t.scope)],
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Polymorphic target: `card` today; notes/jobs later (ERD §2.4). */
    entity_type: text("entity_type").notNull(),
    entity_id: text("entity_id").notNull(),
    fire_at: integer("fire_at", { mode: "timestamp_ms" }).notNull(),
    sent_at: integer("sent_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [
    index("reminders_due_idx").on(t.fire_at),
    index("reminders_entity_idx").on(t.entity_type, t.entity_id),
  ],
);
