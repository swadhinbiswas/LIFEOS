import { and, eq } from "drizzle-orm";

import { DEFAULT_PLAN, planById, type PlanId } from "@/config/plans";
import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { subscriptions, users } from "@/server/db/schema";

/**
 * Subscription state (spec §11, ADR-080). This is the only writer of `subscriptions`; the webhook
 * processor (ADR-081) and any future portal call it, never the table directly.
 */

export type SubscriptionStatus = "active" | "on_hold" | "cancelled" | "expired" | "failed";

export interface SubscriptionView {
  plan: PlanId;
  status: SubscriptionStatus;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

const PLAN_IDS = new Set<string>(Object.keys({ free: 1, pro: 1, team: 1 }));

const toPlanId = (value: string): PlanId =>
  PLAN_IDS.has(value) ? (value as PlanId) : DEFAULT_PLAN;

export async function getSubscription(userId: string): Promise<SubscriptionView | null> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.user_id, userId), eq(subscriptions.provider, "dodo")))
    .limit(1);
  if (!row) return null;
  return {
    plan: toPlanId(row.plan),
    status: row.status as SubscriptionStatus,
    provider: row.provider,
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  };
}

/** The plan a user is entitled to right now: an active subscription, else free. */
export async function currentPlanId(userId: string): Promise<PlanId> {
  const subscription = await getSubscription(userId);
  if (!subscription) return DEFAULT_PLAN;
  return subscription.status === "active" || subscription.status === "on_hold"
    ? planById(subscription.plan).id
    : DEFAULT_PLAN;
}

/**
 * Whether the user was recorded during the free period (spec §11, ADR-082). Read-only; the column
 * is set by the auth flow and the FOUNDER_PERKS policy decides what it may entitle later.
 */
export async function isFounder(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ founder: users.joined_during_free_period })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.founder ?? false;
}

export interface UpsertSubscriptionInput {
  plan: PlanId;
  status: SubscriptionStatus;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

export async function upsertSubscription(
  userId: string,
  input: UpsertSubscriptionInput,
): Promise<void> {
  const values = {
    id: newId(),
    user_id: userId,
    plan: input.plan,
    status: input.status,
    provider: "dodo",
    provider_customer_id: input.providerCustomerId ?? null,
    provider_subscription_id: input.providerSubscriptionId ?? null,
    current_period_end: input.currentPeriodEnd ?? null,
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
  };

  await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: [subscriptions.user_id, subscriptions.provider],
      set: {
        plan: values.plan,
        status: values.status,
        provider_customer_id: values.provider_customer_id,
        provider_subscription_id: values.provider_subscription_id,
        current_period_end: values.current_period_end,
        cancel_at_period_end: values.cancel_at_period_end,
        updated_at: new Date(),
      },
    });
}
