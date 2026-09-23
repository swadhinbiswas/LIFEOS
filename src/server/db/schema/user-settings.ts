import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { users } from "./identity";

/**
 * Per-user settings (ERD §2.1): theme + customizer overrides, remappable shortcuts,
 * locale/timezone/week start, AI preferences. JSON columns hold text validated by Zod at
 * the service boundary (`parseThemeOverrides`), never in SQL (ERD §0).
 *
 * Better Auth never touches this table — `src/server/db` services own every write, so the
 * ERD extras pattern (ADR-036) does not apply: columns here are ours to shape.
 */
export const user_settings = sqliteTable("user_settings", {
  /** ULID via `newId()` (ADR-008) — written by our settings service only. */
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Reserved nullable for future teams (spec line 350; ERD §0). */
  workspace_id: text("workspace_id"),
  /** Resolved preset name (midnight|mocha|gruvbox|phosphor|amber|paper) — spec §4.2. */
  theme: text("theme"),
  /** Customizer overrides as JSON (spec §3) — partial ThemeOverrides, Zod-checked. */
  theme_overrides: text("theme_overrides"),
  /** Remappable keybindings as JSON (spec §10) — null = built-in defaults. */
  shortcuts: text("shortcuts"),
  locale: text("locale"),
  timezone: text("timezone"),
  week_start: text("week_start"),
  /** provider, model, auto-approve allowlist, morning-brief opt-in (spec §10). */
  ai_prefs: text("ai_prefs"),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
