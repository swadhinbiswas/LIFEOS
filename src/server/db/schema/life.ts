import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { users } from "./identity";

/**
 * Life modules (ERD §2.4, spec §6.4–6.9) — the Phase 4 tables, shipped together so later chunks
 * are services + UI rather than migrations (ADR-045).
 *
 * Conventions match the rest of the schema: ULID text ids, integer-ms UTC timestamps, `user_id`
 * on every row so the service layer can scope every query, and **integer minor units** for
 * money. Habit logs are the one deliberate exception to instants: a day is a `YYYY-MM-DD` key,
 * because "today" must not shift when the user's timezone changes (ADR-045).
 */

const timestamps = () => ({
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Habits and goals (§6.4)
// ---------------------------------------------------------------------------

export const habits = sqliteTable(
  "habits",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** RRULE for custom schedules, or `daily` (spec §6.4). */
    cadence: text("cadence").notNull().default("daily"),
    /** `binary` (done/not) or `numeric` (glasses of water, minutes read). */
    kind: text("kind").notNull().default("binary"),
    target: integer("target"),
    unit: text("unit"),
    color: text("color"),
    glyph: text("glyph"),
    /** Days the streak logic forgives (freeze days, spec §6.4). */
    freeze_days: integer("freeze_days").notNull().default(0),
    is_demo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [index("habits_user_idx").on(t.user_id, t.name)],
);

export const habit_logs = sqliteTable(
  "habit_logs",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habit_id: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    /** The user's calendar day, `YYYY-MM-DD` (ADR-045). */
    date: text("date").notNull(),
    value: integer("value").notNull().default(1),
    note: text("note"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("habit_logs_habit_date_unq").on(t.habit_id, t.date),
    index("habit_logs_user_date_idx").on(t.user_id, t.date),
  ],
);

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** `quarter` | `year` | free text; the check-in prompt follows it. */
    period: text("period"),
    /** `active` | `done` | `dropped`. */
    status: text("status").notNull().default("active"),
    ...timestamps(),
  },
  (t) => [index("goals_user_idx").on(t.user_id, t.status)],
);

export const key_results = sqliteTable(
  "key_results",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goal_id: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** `number` | `percent` | `linked` — linked progress is computed from goal_links. */
    kind: text("kind").notNull().default("number"),
    current: integer("current").notNull().default(0),
    target: integer("target").notNull().default(1),
    ...timestamps(),
  },
  (t) => [index("key_results_goal_idx").on(t.goal_id)],
);

export const goal_links = sqliteTable(
  "goal_links",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goal_id: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    /** `card` | `habit` | `note` — progress is derived from what the link points at. */
    entity_type: text("entity_type").notNull(),
    entity_id: text("entity_id").notNull(),
    ...timestamps(),
  },
  (t) => [index("goal_links_goal_idx").on(t.goal_id)],
);

// ---------------------------------------------------------------------------
// Notes and tags (§6.5, §6.9)
// ---------------------------------------------------------------------------

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    /** Markdown, sanitized at render (spec §10). */
    body: text("body").notNull().default(""),
    /** `note` | `daily` | `journal` (spec §6.5). */
    kind: text("kind").notNull().default("note"),
    /** Set for daily notes; the user's calendar day (ADR-045). */
    daily_date: text("daily_date"),
    /** Client-side encrypted entries are not server-searchable (spec §6.5). */
    encrypted: integer("encrypted", { mode: "boolean" }).notNull().default(false),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    archived_at: integer("archived_at", { mode: "timestamp_ms" }),
    deleted_at: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [
    index("notes_user_updated_idx").on(t.user_id, t.updated_at),
    index("notes_user_daily_idx").on(t.user_id, t.daily_date),
  ],
);

export const note_links = sqliteTable(
  "note_links",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    src_note_id: text("src_note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    dst_note_id: text("dst_note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("note_links_pair_unq").on(t.src_note_id, t.dst_note_id),
    index("note_links_dst_idx").on(t.dst_note_id),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("tags_user_name_unq").on(t.user_id, t.name)],
);

export const taggings = sqliteTable(
  "taggings",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tag_id: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    /** Polymorphic: `note` today, other entities as they gain tags (spec §6.9). */
    taggable_type: text("taggable_type").notNull(),
    taggable_id: text("taggable_id").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("taggings_unique").on(t.tag_id, t.taggable_type, t.taggable_id),
    index("taggings_target_idx").on(t.taggable_type, t.taggable_id),
  ],
);

// ---------------------------------------------------------------------------
// Finance-lite, health-lite, learning (§6.6)
// ---------------------------------------------------------------------------

export const accounts_fin = sqliteTable(
  "accounts_fin",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** `cash` | `bank` | `card` | `wallet` — manual accounts only, no bank connections. */
    kind: text("kind").notNull().default("cash"),
    currency: text("currency").notNull(),
    opening_balance_minor: integer("opening_balance_minor").notNull().default(0),
    archived_at: integer("archived_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [index("accounts_fin_user_idx").on(t.user_id, t.name)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    account_id: text("account_id")
      .notNull()
      .references(() => accounts_fin.id, { onDelete: "cascade" }),
    /** Signed minor units: negative is an expense. */
    amount_minor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    category: text("category"),
    merchant: text("merchant"),
    occurred_at: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    note: text("note"),
    ...timestamps(),
  },
  (t) => [index("transactions_user_occurred_idx").on(t.user_id, t.occurred_at)],
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    /** `month` | `week` (spec §6.6). */
    period: text("period").notNull().default("month"),
    limit_minor: integer("limit_minor").notNull(),
    currency: text("currency").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("budgets_user_category_period_unq").on(t.user_id, t.category, t.period)],
);

export const subscriptions_tracked = sqliteTable(
  "subscriptions_tracked",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount_minor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    /** `month` | `year`. */
    cadence: text("cadence").notNull().default("month"),
    renews_at: integer("renews_at", { mode: "timestamp_ms" }),
    note: text("note"),
    ...timestamps(),
  },
  (t) => [index("subscriptions_tracked_user_idx").on(t.user_id, t.renews_at)],
);

export const health_logs = sqliteTable(
  "health_logs",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `sleep` | `workout` | `water` | `mood` | `weight`. */
    kind: text("kind").notNull(),
    value: integer("value").notNull(),
    unit: text("unit"),
    /** The user's calendar day (ADR-045), like habit logs. */
    date: text("date").notNull(),
    note: text("note"),
    ...timestamps(),
  },
  (t) => [index("health_logs_user_kind_date_idx").on(t.user_id, t.kind, t.date)],
);

export const courses = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    provider: text("provider"),
    /** Percent complete, 0–100 (spec §6.6 "progress"). */
    progress: integer("progress").notNull().default(0),
    deadline: integer("deadline", { mode: "timestamp_ms" }),
    url: text("url"),
    ...timestamps(),
  },
  (t) => [index("courses_user_idx").on(t.user_id, t.title)],
);

export const books = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    author: text("author"),
    /** `want` | `reading` | `finished` | `abandoned`. */
    status: text("status").notNull().default("want"),
    notes: text("notes"),
    /** Highlights as JSON `[{text, page}]`. */
    highlights: text("highlights"),
    finished_at: integer("finished_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [index("books_user_status_idx").on(t.user_id, t.status)],
);

// ---------------------------------------------------------------------------
// Focus, time and reviews (§6.7, §6.4)
// ---------------------------------------------------------------------------

export const focus_sessions = sqliteTable(
  "focus_sessions",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Optional link to the card being worked on. */
    card_id: text("card_id"),
    started_at: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    ended_at: integer("ended_at", { mode: "timestamp_ms" }),
    planned_min: integer("planned_min"),
    /** `focus` | `break`. */
    kind: text("kind").notNull().default("focus"),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [index("focus_sessions_user_started_idx").on(t.user_id, t.started_at)],
);

export const time_entries = sqliteTable(
  "time_entries",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    card_id: text("card_id"),
    minutes: integer("minutes").notNull(),
    note: text("note"),
    occurred_at: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps(),
  },
  (t) => [index("time_entries_user_occurred_idx").on(t.user_id, t.occurred_at)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `weekly` | `monthly` (spec §6.2/§6.4). */
    period: text("period").notNull().default("weekly"),
    /** The review wizard's output is a note (ADR-045) — searchable and backlinkable. */
    note_id: text("note_id").references(() => notes.id, { onDelete: "set null" }),
    started_at: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completed_at: integer("completed_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [index("reviews_user_period_idx").on(t.user_id, t.period, t.started_at)],
);

// ---------------------------------------------------------------------------
// Notifications (§6.9)
// ---------------------------------------------------------------------------

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `task` | `habit` | `job` | `billing` | `system`. */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Where clicking it should go. */
    href: text("href"),
    read_at: integer("read_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [index("notifications_user_read_idx").on(t.user_id, t.read_at)],
);
