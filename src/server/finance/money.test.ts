import { describe, expect, it } from "vitest";

import { accountBalance, budgetPercent, formatMinor, spendByCategory } from "./money";

const entry = (
  amountMinor: number,
  category: string | null,
  month = "2026-09",
  currency = "EUR",
) => ({
  amountMinor,
  category,
  month,
  currency,
});

describe("money arithmetic (spec 6.6, adr-045)", () => {
  it("sums expenses per category for the month and ignores income and other months", () => {
    const spend = spendByCategory(
      [
        entry(-12_000, "groceries"),
        entry(-3_500, "groceries"),
        entry(-2_000, "coffee"),
        entry(250_000, "salary"), // income is not budget spend
        entry(-9_999, "groceries", "2026-08"), // another month
        entry(-1_500, null),
      ],
      "2026-09",
    );

    expect(spend).toEqual([
      { category: "groceries", spentMinor: 15_500, currency: "EUR" },
      { category: "coffee", spentMinor: 2_000, currency: "EUR" },
      { category: "(uncategorised)", spentMinor: 1_500, currency: "EUR" },
    ]);
  });

  it("reports currencies separately instead of converting without a rate", () => {
    const spend = spendByCategory(
      [entry(-1_000, "food"), entry(-2_000, "food", "2026-09", "BDT")],
      "2026-09",
    );
    expect(spend).toHaveLength(2);
    expect(spend.map((row) => row.currency).sort()).toEqual(["BDT", "EUR"]);
  });

  it("caps budget progress and handles a missing limit", () => {
    expect(budgetPercent(5_000, 10_000)).toBe(50);
    expect(budgetPercent(25_000, 10_000)).toBe(100);
    expect(budgetPercent(0, 0)).toBe(0);
  });

  it("computes balances from the opening balance plus what hit the account", () => {
    expect(accountBalance(100_000, [{ amountMinor: -12_000 }, { amountMinor: 250_000 }])).toBe(
      338_000,
    );
  });

  it("formats minor units without inventing a currency symbol", () => {
    expect(formatMinor(123_456, "EUR")).toBe("1,234.56 EUR");
    expect(formatMinor(-5_050, "BDT")).toBe("-50.50 BDT");
    expect(formatMinor(7, "USD")).toBe("0.07 USD");
  });
});
