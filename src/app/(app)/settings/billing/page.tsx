import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { FOUNDER_PERKS } from "@/config/plans";
import { billingReady } from "@/env";
import { getServerSession } from "@/server/auth/session";
import { getSubscription, isFounder } from "@/server/billing/subscriptions";

import { BillingActions } from "./_components/billing-actions";

export const metadata = { title: "Billing" };

/**
 * `/settings/billing` (spec §11, ADR-082). While billing is off the page is reachable only by URL
 * (it is not in the nav) and shows the launch notice plus founder status — never a paywall. When the
 * operator enables billing the same page shows the plan, renewal date and the portal.
 */
export default async function BillingPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Billing");
  const [subscription, founder] = await Promise.all([
    getSubscription(session.user.id),
    isFounder(session.user.id),
  ]);

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid max-w-3xl gap-4">
        <Panel title={t("plan")} hint={billingReady ? subscription?.plan : t("freeUntil")}>
          {!billingReady ? (
            <div className="flex flex-col gap-1">
              <p className="font-mono text-xs">{t("launchTitle")}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{t("launchBody")}</p>
            </div>
          ) : (
            <dl className="flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2">
                <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                  {t("status")}
                </dt>
                <dd className="font-mono">{subscription?.status ?? "free"}</dd>
              </div>
              {subscription?.currentPeriodEnd ? (
                <div className="flex items-center gap-2">
                  <dt className="font-mono text-[10px] text-muted-foreground uppercase">
                    {t("plan")}
                  </dt>
                  <dd className="font-mono tabular-nums">
                    {t("renews", {
                      date: subscription.currentPeriodEnd.toISOString().slice(0, 10),
                    })}
                  </dd>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <a
                  href="/api/billing/portal"
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {t("manage")}
                </a>
                {subscription ? null : <BillingActions />}
              </div>
            </dl>
          )}
        </Panel>

        <Panel title={t("founder")} hint={founder ? "yes" : "no"}>
          <p className="font-mono text-[10px] text-muted-foreground">
            {founder ? t("founderYes") : t("founderNo")} {FOUNDER_PERKS.note}
          </p>
        </Panel>
      </div>
    </>
  );
}
