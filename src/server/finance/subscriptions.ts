/**
 * Subscription arithmetic (spec §6.6, ADR-050). Pure so the month-normalised figure the finance
 * page shows is one a test can hand-check, and so the renewal date never depends on a clock the
 * page does not control.
 */

export type Cadence = "month" | "year";

/** A subscription on a monthly footing; a yearly one is spread over twelve months. */
export function monthlyMinorFor(amountMinor: number, cadence: string): number {
  return cadence === "year" ? Math.round(amountMinor / 12) : amountMinor;
}

export interface SubscriptionLike {
  amountMinor: number;
  currency: string;
  cadence: string;
}

/** Monthly cost per currency, never summed across currencies (ADR-045). */
export function subscriptionTotals(
  rows: SubscriptionLike[],
): Array<{ currency: string; monthlyMinor: number }> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const monthly = monthlyMinorFor(row.amountMinor, row.cadence);
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + monthly);
  }
  return [...totals.entries()]
    .map(([currency, monthlyMinor]) => ({ currency, monthlyMinor }))
    .sort((a, b) => b.monthlyMinor - a.monthlyMinor);
}

/** The renewal one cadence after `from`. */
export function nextRenewal(from: Date, cadence: string): Date {
  const next = new Date(from);
  if (cadence === "year") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

/** The first renewal strictly after `now`, skipping any periods that already lapsed. */
export function nextRenewalAfter(from: Date, cadence: string, now: Date): Date {
  let next = nextRenewal(from, cadence);
  for (let guard = 0; next.getTime() <= now.getTime() && guard < 600; guard += 1) {
    next = nextRenewal(next, cadence);
  }
  return next;
}
