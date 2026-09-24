/**
 * Money arithmetic for finance-lite (spec §6.6). Amounts are **integer minor units** with an ISO
 * currency code (ADR-045) — never floats — and aggregation is pure so the numbers on the budget
 * meters are the numbers a test can hand-check.
 */

export interface MoneyLike {
  /** Signed minor units: negative is an expense, positive is income. */
  amountMinor: number;
  currency: string;
  category: string | null;
  /** `YYYY-MM` of when it happened, in the user's terms. */
  month: string;
}

export interface CategorySpend {
  category: string;
  /** Positive minor units actually spent this month. */
  spentMinor: number;
  currency: string;
}

/**
 * Spend per category for one month. Only expenses count (income is not a budget), and currencies
 * are reported separately rather than summed — converting without a rate would be a fabrication.
 */
export function spendByCategory(entries: MoneyLike[], month: string): CategorySpend[] {
  const totals = new Map<string, CategorySpend>();
  for (const entry of entries) {
    if (entry.month !== month) continue;
    if (entry.amountMinor >= 0) continue;
    const category = entry.category?.trim() || "(uncategorised)";
    const key = `${category}\u0000${entry.currency}`;
    const existing = totals.get(key) ?? { category, spentMinor: 0, currency: entry.currency };
    existing.spentMinor += Math.abs(entry.amountMinor);
    totals.set(key, existing);
  }
  return [...totals.values()].sort((a, b) => b.spentMinor - a.spentMinor);
}

/** Budget progress in percent, capped, or 0 when the limit is not positive. */
export function budgetPercent(spentMinor: number, limitMinor: number): number {
  if (limitMinor <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((spentMinor / limitMinor) * 100)));
}

/** Account balance = opening balance plus everything that hit the account. */
export function accountBalance(
  openingMinor: number,
  entries: Array<{ amountMinor: number }>,
): number {
  return entries.reduce((total, entry) => total + entry.amountMinor, openingMinor);
}

/** `123456` minor units in a 2-decimal currency renders as `1234.56` (no symbol guessing). */
export function formatMinor(minor: number, currency: string): string {
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, "0");
  return `${sign}${whole.toLocaleString()}.${cents} ${currency}`;
}
