import { describe, expect, it } from "vitest";

import {
  monthlyMinorFor,
  nextRenewal,
  nextRenewalAfter,
  subscriptionTotals,
} from "./subscriptions";

describe("subscription arithmetic (spec 6.6, adr-050)", () => {
  it("normalises a yearly subscription to a monthly figure", () => {
    expect(monthlyMinorFor(12000, "month")).toBe(12000);
    expect(monthlyMinorFor(12000, "year")).toBe(1000);
    expect(monthlyMinorFor(10000, "year")).toBe(833); // 833.33 minor units, rounded
  });

  it("totals per currency and never crosses currencies", () => {
    const totals = subscriptionTotals([
      { amountMinor: 999, currency: "EUR", cadence: "month" },
      { amountMinor: 12000, currency: "EUR", cadence: "year" },
      { amountMinor: 500, currency: "USD", cadence: "month" },
    ]);
    expect(totals).toEqual([
      { currency: "EUR", monthlyMinor: 1999 },
      { currency: "USD", monthlyMinor: 500 },
    ]);
  });

  it("advances a renewal by one cadence and skips lapsed periods", () => {
    expect(nextRenewal(new Date("2026-01-15T00:00:00.000Z"), "month").toISOString()).toBe(
      "2026-02-15T00:00:00.000Z",
    );
    expect(nextRenewal(new Date("2026-01-15T00:00:00.000Z"), "year").toISOString()).toBe(
      "2027-01-15T00:00:00.000Z",
    );

    const now = new Date("2026-04-20T00:00:00.000Z");
    expect(nextRenewalAfter(new Date("2026-01-15T00:00:00.000Z"), "month", now).toISOString()).toBe(
      "2026-05-15T00:00:00.000Z",
    );
  });
});
