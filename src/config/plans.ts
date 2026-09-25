/**
 * Plans and limits (spec §11, ADR-080). Configuration, not data: no `plans` table, and the free
 * plan is effectively unlimited while `BILLING_ENABLED=false`, so nothing is gated in this release.
 *
 * Prices are deliberately `null` until go-live (ADR-013): we never show a number we cannot charge.
 */

export type PlanId = "free" | "pro" | "team";

export interface PlanLimits {
  boards: number;
  cards: number;
  aiMessagesPerMonth: number;
  apiRequestsPerDay: number;
  cvExports: number;
  storageMb: number;
  historyDays: number;
}

export interface PlanFeatures {
  ai: boolean;
  mcp: boolean;
  api: boolean;
  exports: boolean;
  teams: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** USD per month, or null until a price can actually be charged (ADR-013). */
  priceMonthlyUsd: number | null;
  /** A short positioning line for the pricing page. */
  tagline: string;
  limits: PlanLimits;
  features: PlanFeatures;
}

const UNLIMITED = Number.POSITIVE_INFINITY;

const ALL_FEATURES: PlanFeatures = {
  ai: true,
  mcp: true,
  api: true,
  exports: true,
  teams: false,
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    tagline: "Everything, free, while we are in launch.",
    // Effectively unlimited: the current policy is "free and unlimited for everyone" (spec §11).
    limits: {
      boards: UNLIMITED,
      cards: UNLIMITED,
      aiMessagesPerMonth: UNLIMITED,
      apiRequestsPerDay: UNLIMITED,
      cvExports: UNLIMITED,
      storageMb: UNLIMITED,
      historyDays: UNLIMITED,
    },
    features: { ...ALL_FEATURES },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyUsd: null,
    tagline: "Coming later — early users are protected.",
    limits: {
      boards: 50,
      cards: 50_000,
      aiMessagesPerMonth: 2_000,
      apiRequestsPerDay: 10_000,
      cvExports: 100,
      storageMb: 5_000,
      historyDays: 730,
    },
    features: { ...ALL_FEATURES },
  },
  team: {
    id: "team",
    name: "Team",
    priceMonthlyUsd: null,
    tagline: "For shared workspaces (later).",
    limits: {
      boards: 500,
      cards: 500_000,
      aiMessagesPerMonth: 20_000,
      apiRequestsPerDay: 100_000,
      cvExports: 1_000,
      storageMb: 50_000,
      historyDays: 1_825,
    },
    features: { ...ALL_FEATURES, teams: true },
  },
};

export const DEFAULT_PLAN: PlanId = "free";

/**
 * Founder policy (spec §11): recorded for early users, deliberately not advertised as a promise.
 */
export const FOUNDER_PERKS = {
  /** Early users keep Pro-level access for life if Pro ever ships. */
  lifetimePro: true,
  note: "Early users are recorded so benefits can be granted later without a migration.",
} as const;

const PLAN_IDS = new Set<string>(Object.keys(PLANS));

export function planById(id: string | null | undefined): Plan {
  return id && PLAN_IDS.has(id) ? PLANS[id as PlanId] : PLANS[DEFAULT_PLAN];
}

/** Render a limit for the UI: `Infinity` reads as "Unlimited", never as a number. */
export function formatLimit(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString("en-US") : "Unlimited";
}
