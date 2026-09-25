import { billingEnabled } from "@/env";
import {
  PLANS,
  planById,
  type Plan,
  type PlanFeatures,
  type PlanId,
  type PlanLimits,
} from "@/config/plans";

import { currentPlanId } from "./subscriptions";

/**
 * The single entitlement resolver (spec §11, ADR-080). Every surface — UI, REST, MCP and AI —
 * asks these functions, so a plan rule cannot drift between them.
 *
 * While `BILLING_ENABLED=false` this returns the free plan directly and never touches the database:
 * free is unlimited, so nothing is limited in this release.
 */

export type EntitlementFeature = keyof PlanFeatures;
export type EntitlementLimit = keyof PlanLimits;

/** The plan in force for a user right now. */
export async function planFor(userId: string): Promise<Plan> {
  if (!billingEnabled) return PLANS.free;
  return planById(await currentPlanId(userId));
}

export async function can(userId: string, feature: EntitlementFeature): Promise<boolean> {
  const plan = await planFor(userId);
  return plan.features[feature];
}

export async function limit(userId: string, key: EntitlementLimit): Promise<number> {
  const plan = await planFor(userId);
  return plan.limits[key];
}

export class EntitlementError extends Error {
  constructor(
    readonly key: EntitlementLimit,
    readonly max: number,
  ) {
    super(`limit reached: ${key}`);
    this.name = "EntitlementError";
  }
}

/**
 * Throw when `used` is already at the ceiling. Call sites stay cheap today (unlimited), and become
 * real the moment a finite plan is in force.
 */
export async function assertWithinLimit(
  userId: string,
  key: EntitlementLimit,
  used: number,
): Promise<void> {
  const max = await limit(userId, key);
  if (Number.isFinite(max) && used >= max) throw new EntitlementError(key, max);
}

/** Whether a plan id is one we know (for webhook payloads that carry a plan name). */
export function isKnownPlan(value: string): value is PlanId {
  return value === "free" || value === "pro" || value === "team";
}
