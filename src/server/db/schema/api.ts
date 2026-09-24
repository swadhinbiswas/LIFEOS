import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { users } from "./identity";

/**
 * Personal API keys (spec §9.1, ADR-062). Shown once at creation; only the SHA-256 hash and a
 * lookup prefix are stored, so a database leak does not hand over usable keys. Scopes are a JSON
 * array of strings (`read:*`, `write:tasks`, …) validated at the service boundary.
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

export const api_keys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** The public lookup half of the token; unique so a prefix finds at most one row. */
    prefix: text("prefix").notNull(),
    /** SHA-256 hex of the full token — never the token itself. */
    key_hash: text("key_hash").notNull(),
    /** JSON array of granted scopes. */
    scopes: text("scopes").notNull().default("[]"),
    expires_at: integer("expires_at", { mode: "timestamp_ms" }),
    last_used_at: integer("last_used_at", { mode: "timestamp_ms" }),
    revoked_at: integer("revoked_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("api_keys_prefix_unq").on(t.prefix),
    index("api_keys_user_idx").on(t.user_id),
  ],
);
