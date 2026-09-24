import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { users } from "./identity";

/**
 * Outgoing webhooks (spec §9.3, ADR-066). A subscription is one URL + a generated secret + the
 * events it wants; each attempt is a delivery row, so the log is queryable and replayable. Delivery
 * is best-effort and never blocks the write that triggered it.
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

export const webhooks_out = sqliteTable(
  "webhooks_out",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Shared secret for the HMAC signature; shown once at creation. */
    secret: text("secret").notNull(),
    /** JSON array of subscribed event names. */
    events: text("events").notNull().default("[]"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("webhooks_out_user_idx").on(t.user_id)],
);

export const webhook_deliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    webhook_id: text("webhook_id")
      .notNull()
      .references(() => webhooks_out.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    /** The exact signed body. */
    payload: text("payload").notNull(),
    /** HTTP status, or 0 when the request never completed. */
    response_status: integer("response_status").notNull().default(0),
    error: text("error"),
    attempts: integer("attempts").notNull().default(1),
    delivered_at: integer("delivered_at", { mode: "timestamp_ms" }),
    /** When the next retry is due (ADR-069); null when delivered or exhausted. */
    next_attempt_at: integer("next_attempt_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [index("webhook_deliveries_user_idx").on(t.user_id, t.created_at)],
);
