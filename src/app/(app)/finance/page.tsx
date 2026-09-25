import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { Progress } from "@/components/ui/progress";
import { getServerSession } from "@/server/auth/session";
import {
  listAccounts,
  listSubscriptions,
  listTransactions,
  monthKey,
  monthSummary,
} from "@/server/finance";
import { formatMinor, monthlyFlows } from "@/server/finance/money";
import { subscriptionTotals } from "@/server/finance/subscriptions";
import { getTimeZone } from "@/server/settings";

import {
  AddAccountForm,
  AddBudgetForm,
  AddSubscriptionForm,
  AddTransactionForm,
} from "./_components/finance-forms";
import { SubscriptionControls } from "./_components/subscription-controls";
import { SpendChart } from "./_components/spend-chart";
import { SpendHistory } from "./_components/spend-history";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Finance", "title");
}

/**
 * `/finance` (spec §6.6, "finance-lite"): manual accounts, transactions and monthly budgets with
 * progress meters. No bank connections and no advice — the disclaimer is part of the page, not a
 * footnote — and nothing converts currencies without a rate.
 */
export default async function FinancePage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Finance");
  const locale = await getLocale();
  const [accounts, summary, recent, subscriptions] = await Promise.all([
    listAccounts(session.user.id),
    monthSummary(session.user.id),
    listTransactions(session.user.id, 500),
    listSubscriptions(session.user.id, new Date(), await getTimeZone(session.user.id)),
  ]);
  const history = monthlyFlows(
    recent.map((row) => ({
      amountMinor: row.amount_minor,
      currency: row.currency,
      month: monthKey(new Date(row.occurred_at)),
    })),
    { months: 6 },
  );
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "short" });
  const historyData = history.flows.map((flow) => ({
    month: monthLabel.format(new Date(`${flow.month}-01T00:00:00Z`)),
    income: flow.incomeMinor / 100,
    spend: flow.spendMinor / 100,
  }));
  const subscriptionTotal = subscriptionTotals(
    subscriptions.map(({ subscription }) => ({
      amountMinor: subscription.amount_minor,
      currency: subscription.currency,
      cadence: subscription.cadence,
    })),
  );
  const accountName = (id: string) =>
    accounts.find((row) => row.account.id === id)?.account.name ?? "";

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid max-w-4xl gap-4">
        <p className="font-mono text-[10px] text-muted-foreground" data-slot="finance-disclaimer">
          {t("disclaimer")}
        </p>

        <Panel title={t("accounts")} hint={`${accounts.length}`}>
          <AddAccountForm />
          {accounts.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noAccounts")}</p>
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

        <Panel
          title={t("thisMonth", { month: summary.month })}
          hint={t("currencies", { count: summary.totals.length })}
        >
          {summary.totals.length > 0 ? (
            <SpendChart
              data={summary.totals.map((total) => ({
                currency: total.currency,
                income: total.incomeMinor / 100,
                spend: total.spendMinor / 100,
              }))}
              title={t("chartTitle")}
              incomeLabel={t("income")}
              spendLabel={t("expense")}
            />
          ) : null}
          {summary.totals.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("nothingRecorded")}</p>
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

          {history.currency && historyData.some((row) => row.income > 0 || row.spend > 0) ? (
            <SpendHistory
              data={historyData}
              title={t("historyTitle")}
              incomeLabel={t("income")}
              spendLabel={t("expense")}
              currency={history.currency}
            />
          ) : null}

          <div className="flex flex-col gap-2">
            <AddBudgetForm />
            {summary.budgets.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">{t("noBudgets")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {summary.budgets.map((budget) => (
                  <li
                    key={budget.id}
                    data-slot="budget-row"
                    className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border px-2 py-1.5 font-mono text-xs transition-colors hover:border-ring"
                  >
                    <span className="min-w-0 flex-1 truncate">{budget.category}</span>
                    <Progress
                      value={Math.min(100, budget.percent)}
                      aria-label={budget.category}
                      className={
                        budget.percent >= 100
                          ? "h-1.5 w-24 [&>[data-slot=progress-indicator]]:bg-destructive"
                          : "h-1.5 w-24"
                      }
                    />
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

        <Panel title={t("subscriptions")} hint={`${subscriptions.length}`}>
          <AddSubscriptionForm />
          {subscriptionTotal.length > 0 ? (
            <p
              data-slot="subscription-total"
              className="font-mono text-[10px] text-muted-foreground"
            >
              {subscriptionTotal
                .map((total) => `${formatMinor(total.monthlyMinor, total.currency)} / mo`)
                .join(" · ")}{" "}
              {t("monthNormalised")}
            </p>
          ) : null}
          {subscriptions.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noSubscriptions")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {subscriptions.map(({ subscription, monthlyMinor, dueInDays }) => (
                <li
                  key={subscription.id}
                  data-slot="subscription-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                >
                  <span className="min-w-0 flex-1 truncate">{subscription.name}</span>
                  <span className="tabular-nums">
                    {formatMinor(subscription.amount_minor, subscription.currency)} /{" "}
                    {subscription.cadence}
                  </span>
                  {subscription.cadence !== "month" ? (
                    <span className="text-muted-foreground tabular-nums">
                      {formatMinor(monthlyMinor, subscription.currency)} / mo
                    </span>
                  ) : null}
                  <span className="text-muted-foreground">
                    {subscription.renews_at ? (
                      <>
                        <time dateTime={new Date(subscription.renews_at).toISOString()}>
                          {new Date(subscription.renews_at).toISOString().slice(0, 10)}
                        </time>
                        {dueInDays !== null
                          ? ` ${t(dueInDays > 0 ? "dueIn" : dueInDays === 0 ? "dueToday" : "dueLate", { days: Math.abs(dueInDays) })}`
                          : ""}
                      </>
                    ) : (
                      t("noRenewal")
                    )}
                  </span>
                  <SubscriptionControls subscriptionId={subscription.id} name={subscription.name} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("activity")} hint={`${recent.length}`}>
          <AddTransactionForm
            accounts={accounts.map(({ account }) => ({
              id: account.id,
              name: account.name,
              currency: account.currency,
            }))}
          />
          {recent.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noTransactions")}</p>
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
