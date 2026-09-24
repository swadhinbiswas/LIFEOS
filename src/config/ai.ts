/**
 * AI copilot configuration (spec §8/§11). Plans and entitlements arrive in Phase 7; until then these
 * are generous ceilings that exist so the call site and its tests are already in place. Prices are
 * deliberately **not** hard-coded — we show tokens and never invent a cost we cannot source.
 */
export const AI_LIMITS = {
  /** Runs (assistant turns) allowed per calendar month on the current free plan. */
  runsPerMonth: 2000,
  /** Token budget per month; 0 disables the ceiling (used until entitlements land). */
  costMicrosPerMonth: 0,
} as const;

/** How many items the always-fresh user context may include per section (ADR-077). */
export const AI_CONTEXT_LIMITS = {
  cards: 20,
  goals: 10,
  jobs: 10,
  habits: 20,
} as const;
