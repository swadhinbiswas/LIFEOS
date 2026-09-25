import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { users } from "./identity";

const timestamps = () => ({
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

/**
 * External activity providers (ADR-110). One row per user per provider, holding the API key
 * encrypted with the ADR-074 AES-256-GCM helper. WakaTime is the only provider today, but the
 * column is `provider` rather than a WakaTime-specific table, so a second one is a row and not a
 * migration.
 */
export const activity_connections = sqliteTable(
  "activity_connections",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "wakatime" today; the provider owns the meaning of everything below. */
    provider: text("provider").notNull(),
    /** iv.tag.ciphertext, base64 (ADR-074). Never returned to a caller in plaintext. */
    secret_encrypted: text("secret_encrypted").notNull(),
    /** Last four characters, the only part ever shown back. */
    hint: text("hint").notNull(),
    /** When the last sync completed, so the dashboard can say how fresh the numbers are. */
    last_synced_at: integer("last_synced_at", { mode: "timestamp_ms" }),
    /** A short, human-readable failure from the last attempt; null when the last one worked. */
    last_error: text("last_error"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("activity_connections_user_provider_unq").on(t.user_id, t.provider)],
);

/**
 * One cached day of coding activity, exactly as the provider reported it.
 *
 * This is a cache of a *remote* source, which is the one place this repo keeps a denormalised row:
 * WakaTime cannot be queried offline, and a chart would otherwise need a network round trip on every
 * render (ADR-110). Nothing here is computed by LifeOS, every field is a number the provider reported,
 * and re-syncing a day overwrites it, so a retry can never double-count.
 */
export const code_activity_daily = sqliteTable(
  "code_activity_daily",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The provider day key, `YYYY-MM-DD`, as it reported it. */
    day: text("day").notNull(),
    /** Total coding seconds for the day: the provider grand_total.total_seconds. */
    total_seconds: real("total_seconds").notNull().default(0),
    /** Lines the provider attributes to AI tooling, and to the human, separately. */
    ai_additions: integer("ai_additions").notNull().default(0),
    ai_deletions: integer("ai_deletions").notNull().default(0),
    human_additions: integer("human_additions").notNull().default(0),
    human_deletions: integer("human_deletions").notNull().default(0),
    /** The provider own estimate of what that day of AI usage cost, in USD. */
    ai_cost_usd: real("ai_cost_usd").notNull().default(0),
    /** Top-N breakdowns kept verbatim as JSON: languages, editors, projects. */
    languages: text("languages").notNull().default("[]"),
    editors: text("editors").notNull().default("[]"),
    projects: text("projects").notNull().default("[]"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("code_activity_daily_user_day_unq").on(t.user_id, t.day),
    index("code_activity_daily_user_day_idx").on(t.user_id, t.day),
  ],
);
