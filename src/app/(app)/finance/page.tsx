import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { listAccounts, listTransactions, monthSummary } from "@/server/finance";
import { formatMinor } from "@/server/finance/money";

import { AddAccountForm, AddBudgetForm, AddTransactionForm } from "./_components/finance-forms";

export const metadata = { title: "Finance" };

/**
 * `/finance` (spec §6.6, "finance-lite"): manual accounts, transactions and monthly budgets with
 * progress meters. No bank connections and no advice — the disclaimer is part of the page, not a
 * footnote — and nothing converts currencies without a rate.
 */
export default async function FinancePage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const [accounts, summary, recent] = await Promise.all([
    listAccounts(session.user.id),
    monthSummary(session.user.id),
    listTransactions(session.user.id),
  ]);
  const accountName = (id: string) =>
    accounts.find((row) => row.account.id === id)?.account.name ?? "";

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Finance</h1>

      <div className="grid max-w-4xl gap-4">
        <p className="font-mono text-[10px] text-muted-foreground" data-slot="finance-disclaimer">
          manual accounts only — no bank connections, and this is not financial advice. Amounts are
          kept in the currency you entered; nothing is converted without an exchange rate.
        </p>

        <Panel title="Accounts" hint={`${accounts.length}`}>
          <AddAccountForm />
          {accounts.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">no accounts yet</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {accounts.map(({ account, balanceMinor }) => (
                <li
                  key={account.id}
                  data-slot="account-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                >
                  <span className="min-w-0 flex-1 truncate">{account.name}</span>
                  <span className="text-muted-foreground">{account.kind}</span>
                  <span className="tabular-nums">
                    {formatMinor(balanceMinor, account.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`This month · ${summary.month}`} hint={`${summary.totals.length} currencies`}>
          {summary.totals.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">nothing recorded this month</p>
          ) : (
            <ul className="flex flex-wrap gap-3 font-mono text-xs">
              {summary.totals.map((total) => (
                <li
                  key={total.currency}
                  data-slot="month-total"
                  className="border border-border px-2 py-1"
                >
                  <span className="text-muted-foreground">{total.currency}</span>{" "}
                  <span className="text-success">
                    +{formatMinor(total.incomeMinor, total.currency)}
                  </span>{" "}
                  <span className="text-destructive">
                    -{formatMinor(total.spendMinor, total.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2">
            <AddBudgetForm />
            {summary.budgets.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">
                no budgets yet — set one per category you want to watch
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {summary.budgets.map((budget) => (
                  <li
                    key={budget.id}
                    data-slot="budget-row"
                    className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">{budget.category}</span>
                    <span
                      aria-hidden="true"
                      className={budget.percent >= 100 ? "text-destructive" : "text-primary"}
                    >
                      {"▇".repeat(Math.round(budget.percent / 10))}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatMinor(budget.spentMinor, budget.currency)} /{" "}
                      {formatMinor(budget.limit_minor, budget.currency)} ({budget.percent}%)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Activity" hint={`${recent.length}`}>
          <AddTransactionForm
            accounts={accounts.map(({ account }) => ({
              id: account.id,
              name: account.name,
              currency: account.currency,
            }))}
          />
          {recent.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">no transactions yet</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recent.map((row) => (
                <li
                  key={row.id}
                  data-slot="transaction-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                >
                  <time dateTime={new Date(row.occurred_at).toISOString()}>
                    {new Date(row.occurred_at).toISOString().slice(0, 10)}
                  </time>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {row.category ?? ""} {row.merchant ?? ""}
                  </span>
                  <span className="text-muted-foreground">{accountName(row.account_id)}</span>
                  <span className={row.amount_minor < 0 ? "text-destructive" : "text-success"}>
                    {formatMinor(row.amount_minor, row.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
