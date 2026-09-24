import { and, desc, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { accounts_fin, budgets, transactions } from "@/server/db/schema";

import { accountBalance, budgetPercent, spendByCategory, type CategorySpend } from "./money";

/**
 * Finance-lite (spec §6.6): manually entered accounts and transactions, monthly budgets with
 * progress, all in integer minor units (ADR-045). No bank connections, no advice — the page says
 * so plainly, and nothing here guesses a currency conversion.
 */

export type AccountRow = typeof accounts_fin.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type BudgetRow = typeof budgets.$inferSelect;

export const monthKey = (date: Date): string => date.toISOString().slice(0, 7);

export interface AccountView {
  account: AccountRow;
  balanceMinor: number;
}

export async function listAccounts(userId: string): Promise<AccountView[]> {
  const [accountRows, transactionRows] = await Promise.all([
    db
      .select()
      .from(accounts_fin)
      .where(eq(accounts_fin.user_id, userId))
      .orderBy(accounts_fin.name),
    db
      .select({ accountId: transactions.account_id, amountMinor: transactions.amount_minor })
      .from(transactions)
      .where(eq(transactions.user_id, userId)),
  ]);

  return accountRows.map((account) => ({
    account,
    balanceMinor: accountBalance(
      account.opening_balance_minor,
      transactionRows.filter((row) => row.accountId === account.id),
    ),
  }));
}

export async function createAccount(
  userId: string,
  input: { name: string; kind?: string; currency: string; openingMinor?: number },
): Promise<AccountRow> {
  const [row] = await db
    .insert(accounts_fin)
    .values({
      id: newId(),
      user_id: userId,
      name: input.name.trim(),
      kind: input.kind ?? "cash",
      currency: input.currency.toUpperCase(),
      opening_balance_minor: input.openingMinor ?? 0,
    })
    .returning();
  if (!row) throw new Error("account insert returned no row");
  return row;
}

export async function addTransaction(
  userId: string,
  input: {
    accountId: string;
    /** Signed minor units: the caller decides expense (negative) or income (positive). */
    amountMinor: number;
    currency?: string;
    category?: string | null;
    merchant?: string | null;
    occurredAt?: Date;
    note?: string | null;
  },
): Promise<TransactionRow> {
  const [account] = await db
    .select()
    .from(accounts_fin)
    .where(and(eq(accounts_fin.id, input.accountId), eq(accounts_fin.user_id, userId)))
    .limit(1);
  if (!account) throw new Error("account not found");

  const [row] = await db
    .insert(transactions)
    .values({
      id: newId(),
      user_id: userId,
      account_id: account.id,
      amount_minor: input.amountMinor,
      currency: (input.currency ?? account.currency).toUpperCase(),
      category: input.category ?? null,
      merchant: input.merchant ?? null,
      occurred_at: input.occurredAt ?? new Date(),
      note: input.note ?? null,
    })
    .returning();
  if (!row) throw new Error("transaction insert returned no row");
  return row;
}

export async function listTransactions(userId: string, limit = 20): Promise<TransactionRow[]> {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.user_id, userId))
    .orderBy(desc(transactions.occurred_at))
    .limit(limit);
}

export async function setBudget(
  userId: string,
  input: { category: string; period?: string; limitMinor: number; currency: string },
): Promise<BudgetRow> {
  const [row] = await db
    .insert(budgets)
    .values({
      id: newId(),
      user_id: userId,
      category: input.category.trim(),
      period: input.period ?? "month",
      limit_minor: input.limitMinor,
      currency: input.currency.toUpperCase(),
    })
    .onConflictDoUpdate({
      target: [budgets.user_id, budgets.category, budgets.period],
      set: { limit_minor: input.limitMinor, currency: input.currency.toUpperCase() },
    })
    .returning();
  if (!row) throw new Error("budget upsert returned no row");
  return row;
}

export interface BudgetProgress extends BudgetRow {
  spentMinor: number;
  percent: number;
}

export interface MonthSummary {
  month: string;
  spend: CategorySpend[];
  budgets: BudgetProgress[];
  /** Income and spend per currency, never summed across currencies. */
  totals: Array<{ currency: string; incomeMinor: number; spendMinor: number }>;
}

export async function monthSummary(
  userId: string,
  month = monthKey(new Date()),
): Promise<MonthSummary> {
  const [transactionRows, budgetRows] = await Promise.all([
    db.select().from(transactions).where(eq(transactions.user_id, userId)),
    db.select().from(budgets).where(eq(budgets.user_id, userId)),
  ]);

  const entries = transactionRows.map((row) => ({
    amountMinor: row.amount_minor,
    currency: row.currency,
    category: row.category,
    month: monthKey(new Date(row.occurred_at)),
  }));
  const spend = spendByCategory(entries, month);

  const totalsByCurrency = new Map<
    string,
    { currency: string; incomeMinor: number; spendMinor: number }
  >();
  for (const entry of entries) {
    if (entry.month !== month) continue;
    const bucket = totalsByCurrency.get(entry.currency) ?? {
      currency: entry.currency,
      incomeMinor: 0,
      spendMinor: 0,
    };
    if (entry.amountMinor >= 0) bucket.incomeMinor += entry.amountMinor;
    else bucket.spendMinor += Math.abs(entry.amountMinor);
    totalsByCurrency.set(entry.currency, bucket);
  }

  const budgetsWithProgress = budgetRows.map((budget) => {
    const spent =
      spend.find((row) => row.category === budget.category && row.currency === budget.currency)
        ?.spentMinor ?? 0;
    return { ...budget, spentMinor: spent, percent: budgetPercent(spent, budget.limit_minor) };
  });

  return { month, spend, budgets: budgetsWithProgress, totals: [...totalsByCurrency.values()] };
}
