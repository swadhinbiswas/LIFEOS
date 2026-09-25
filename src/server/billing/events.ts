import { eq, sql } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { billing_events } from "@/server/db/schema";

import { upsertSubscription, type SubscriptionStatus } from "./subscriptions";

/**
 * Billing webhook processing (spec §11, ADR-081). `applyBillingEvent` is idempotent on the Standard
 * Webhooks `webhook-id`: the first delivery records the event and updates the subscription, a
 * replay inserts nothing and reports `duplicate`. Nothing here trusts the payload beyond the fields
 * we map, and a payload we cannot attribute to a user is recorded but changes no subscription.
 */

export interface BillingEventInput {
  /** The `webhook-id` header. */
  eventId: string;
  type: string;
  businessId?: string | null;
  payload: unknown;
}

export interface BillingEventResult {
  duplicate: boolean;
  applied: boolean;
  userId: string | null;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const str = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** subscription.* → our status; payment.* leaves the existing status unless it says otherwise. */
function statusForType(type: string): SubscriptionStatus | null {
  switch (type) {
    case "subscription.active":
    case "subscription.renewed":
    case "subscription.plan_changed":
    case "subscription.updated":
      return "active";
    case "subscription.on_hold":
      return "on_hold";
    case "subscription.cancelled":
      return "cancelled";
    case "subscription.expired":
      return "expired";
    case "subscription.failed":
      return "failed";
    default:
      return null;
  }
}

/** Dodo's payload nests the entity under `data`; metadata and ids live there. */
function readEntity(payload: unknown) {
  const data = asRecord(asRecord(payload).data);
  const metadata = asRecord(data.metadata);
  const customer = asRecord(data.customer);
  return {
    metadata,
    userId: str(metadata.userId) ?? str(metadata.user_id),
    plan: str(metadata.plan),
    subscriptionId: str(data.subscription_id),
    customerId: str(data.customer_id) ?? str(customer.customer_id),
    currentPeriodEnd: str(data.next_billing_date) ?? str(data.current_period_end),
    cancelAtPeriodEnd: data.cancel_at_next_billing_date === true,
  };
}

export async function applyBillingEvent(input: BillingEventInput): Promise<BillingEventResult> {
  const entity = readEntity(input.payload);

  // Idempotency first: the UNIQUE(event_id) is the lock, so a concurrent replay is also safe.
  const inserted = await db
    .insert(billing_events)
    .values({
      id: newId(),
      event_id: input.eventId,
      type: input.type,
      business_id: input.businessId ?? null,
      user_id: entity.userId,
      payload: JSON.stringify(input.payload ?? null),
    })
    .onConflictDoNothing({ target: billing_events.event_id })
    .returning({ id: billing_events.id });

  if (inserted.length === 0) return { duplicate: true, applied: false, userId: entity.userId };

  const status = statusForType(input.type);
  if (!entity.userId || !status) {
    await db
      .update(billing_events)
      .set({ processed_at: new Date() })
      .where(eq(billing_events.event_id, input.eventId));
    return { duplicate: false, applied: false, userId: entity.userId };
  }

  await upsertSubscription(entity.userId, {
    plan: entity.plan === "team" ? "team" : "pro",
    status,
    providerCustomerId: entity.customerId,
    providerSubscriptionId: entity.subscriptionId,
    currentPeriodEnd: entity.currentPeriodEnd ? new Date(entity.currentPeriodEnd) : null,
    cancelAtPeriodEnd: entity.cancelAtPeriodEnd,
  });

  await db
    .update(billing_events)
    .set({ processed_at: new Date() })
    .where(eq(billing_events.event_id, input.eventId));

  return { duplicate: false, applied: true, userId: entity.userId };
}

/** Count of recorded events — used by the health/verification surfaces. */
export async function billingEventCount(): Promise<number> {
  const [row] = await db.select({ value: sql<number>`count(*)` }).from(billing_events);
  return Number(row?.value ?? 0);
}
