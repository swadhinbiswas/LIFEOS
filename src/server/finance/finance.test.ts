/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/finance-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/finance-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { addTransaction, createAccount, listAccounts, listTransactions, monthSummary, setBudget } =
  await import("./index");

const USER = "01HFINANCE0000000000000000001";
const OTHER = "01HFINANCE0000000000000000002";

describe("finance-lite (spec 6.6, adr-045)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [USER, OTHER].map((id) => ({
        id,
        email: `${id.toLowerCase()}@example.test`,
        name: id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  });

  it("derives balances, month totals and budget progress from the transactions", async () => {
    const account = await createAccount(USER, {
      name: "Current",
      currency: "EUR",
      openingMinor: 100_000,
    });

    await addTransaction(USER, {
      accountId: account.id,
      amountMinor: -12_000,
      category: "groceries",
    });
    await addTransaction(USER, {
      accountId: account.id,
      amountMinor: -3_500,
      category: "groceries",
    });
    await addTransaction(USER, { accountId: account.id, amountMinor: 250_000, category: "salary" });
    await setBudget(USER, { category: "groceries", limitMinor: 20_000, currency: "EUR" });

    const [view] = await listAccounts(USER);
    expect(view?.balanceMinor).toBe(334_500); // 100000 - 12000 - 3500 + 250000

    const summary = await monthSummary(USER);
    const groceries = summary.spend.find((row) => row.category === "groceries");
    expect(groceries?.spentMinor).toBe(15_500);
    const budget = summary.budgets.find((row) => row.category === "groceries");
    expect(budget?.spentMinor).toBe(15_500);
    expect(budget?.percent).toBe(78); // 15500 / 20000

    const euro = summary.totals.find((row) => row.currency === "EUR");
    expect(euro).toEqual({ currency: "EUR", incomeMinor: 250_000, spendMinor: 15_500 });

    // Budgets upsert by (category, period) instead of duplicating.
    await setBudget(USER, { category: "groceries", limitMinor: 25_000, currency: "EUR" });
    const updated = await monthSummary(USER);
    expect(updated.budgets.filter((row) => row.category === "groceries")).toHaveLength(1);
    expect(updated.budgets[0]?.limit_minor).toBe(25_000);
  });

  it("keeps money private and refuses a transaction on someone else's account", async () => {
    expect(await listAccounts(OTHER)).toEqual([]);
    expect(await listTransactions(OTHER)).toEqual([]);
    const [mine] = await listAccounts(USER);
    if (!mine) throw new Error("account missing");
    await expect(
      addTransaction(OTHER, { accountId: mine.account.id, amountMinor: -100 }),
    ).rejects.toThrow();
  });
});
