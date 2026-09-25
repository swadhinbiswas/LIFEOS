import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Identity tables (ERD §2.1) — Better Auth's four models mapped onto the ERD (ADR-036).
 *
 * Contract, verified against `@better-auth/core` `get-tables.mjs` at the pinned 1.7.5:
 * column **property keys** must equal the fieldName resolved by the
 * `options.<model>.fields` overrides in `src/server/auth` — the adapter's schema
 * self-check (enabled by default) and its runtime lookups key off properties. SQL names
 * are the same snake_case strings (ERD literal). Re-read that source file before renaming.
 *
 * Dates: `integer({ mode: "timestamp_ms" })` — Better Auth passes `Date` values, Drizzle
 * stores integer ms UTC (ERD convention) and reads back `Date` (ADR-036). This *is* the
 * "number-for-dates" mechanism ADR-030 asked about: there is no adapter flag.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  /** 0|1 — Better Auth's boolean field (renamed from email_verified_at, ADR-036). */
  email_verified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  name: text("name").notNull(),
  image: text("image"),
  // ERD §2.1 extras that Better Auth never writes: nullable/defaulted so BA inserts
  // satisfy diffSchema's unexpected-required-column rule (ADR-036). No fabricated data:
  // locale/timezone/week_start stay null until the user sets them; render-time fallbacks
  // (en/UTC/mon) live in the service layer (spec line 302: "configurable").
  bio: text("bio"),
  locale: text("locale"),
  timezone: text("timezone"),
  week_start: text("week_start"),
  onboarded_at: integer("onboarded_at", { mode: "timestamp_ms" }),
  is_demo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  // spec line 426: early users must be recorded true while BILLING_ENABLED=false
  // (ADR-013); Phase 7 flips this default when paid plans exist.
  joined_during_free_period: integer("joined_during_free_period", { mode: "boolean" })
    .notNull()
    .default(true),
  // spec §10 / ADR-083: a hard delete is scheduled, not immediate. Null = no request; the purge
  // cron removes accounts whose grace period has passed.
  deletion_requested_at: integer("deletion_requested_at", { mode: "timestamp_ms" }),
  created_at: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires_at: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ip: text("ip"),
    user_agent: text("user_agent"),
    created_at: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.user_id)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    account_id: text("account_id").notNull(),
    provider_id: text("provider_id").notNull(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    access_token: text("access_token"),
    refresh_token: text("refresh_token"),
    id_token: text("id_token"),
    access_token_expires_at: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refresh_token_expires_at: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    /** credential hash for email/password (provider_id "credential"); never returned. */
    password: text("password"),
    created_at: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("accounts_user_id_idx").on(t.user_id)],
);

/** Email-verify / password-reset tokens (ERD §2.1): identifier = the user's email. */
export const verifications = sqliteTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expires_at: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    created_at: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.user_id], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.user_id], references: [users.id] }),
}));
