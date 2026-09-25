import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { users } from "./identity";

/**
 * Billing tables (spec §7.3/§11, ADR-080). Plans are configuration (`config/plans.ts`), not rows;
 * what we persist is each user's subscription state, the raw webhook log (idempotent by event id,
 * ADR-081) and any explicit entitlement grants.
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

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** free | pro | team */
    plan: text("plan").notNull().default("free"),
    /** active | on_hold | cancelled | expired | failed */
    status: text("status").notNull().default("active"),
    /** Always "dodo" today; kept explicit so an alternate MoR (ADR-013) is a value, not a rewrite. */
    provider: text("provider").notNull().default("dodo"),
    provider_customer_id: text("provider_customer_id"),
    provider_subscription_id: text("provider_subscription_id"),
    current_period_end: integer("current_period_end", { mode: "timestamp_ms" }),
    cancel_at_period_end: integer("cancel_at_period_end", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("subscriptions_user_provider_idx").on(t.user_id, t.provider),
    index("subscriptions_user_idx").on(t.user_id),
  ],
);

export const billing_events = sqliteTable(
  "billing_events",
  {
    id: text("id").primaryKey(),
    /** The Standard Webhooks `webhook-id` — the idempotency key (ADR-081). */
    event_id: text("event_id").notNull(),
    /** e.g. `subscription.active`, `payment.succeeded`. */
    type: text("type").notNull(),
    business_id: text("business_id"),
    user_id: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** The raw payload, for audit and replay debugging. */
    payload: text("payload").notNull(),
    processed_at: integer("processed_at", { mode: "timestamp_ms" }),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("billing_events_event_idx").on(t.event_id)],
);

export const entitlements = sqliteTable(
  "entitlements",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** A plan feature key, e.g. `mcp` or `ai`. */
    key: text("key").notNull(),
    /** JSON value; usually `true`, or a numeric override. */
    value: text("value").notNull().default("true"),
    /** Where it came from: `subscription`, `founder`, `manual`. */
    source: text("source").notNull().default("manual"),
    expires_at: integer("expires_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("entitlements_user_key_idx").on(t.user_id, t.key)],
);
