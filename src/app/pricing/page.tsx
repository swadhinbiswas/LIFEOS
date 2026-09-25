import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { formatLimit, PLANS } from "@/config/plans";
import { billingEnabled } from "@/env";

export const metadata = { title: "Pricing" };

/**
 * Public `/pricing` (spec §11, ADR-082). It renders **from `config/plans.ts`**, so the marketing
 * copy can never drift from the limits the app enforces. While billing is disabled only the free
 * plan is presented, with the "Pro coming later, early users are protected" note.
 */
export default async function PricingPage() {
  const t = await getTranslations("Pages.Pricing");
  const plans = billingEnabled ? [PLANS.free, PLANS.pro, PLANS.team] : [PLANS.free];

  return (
    <main className="mx-auto w-full max-w-3xl p-4">
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h1>

      <div className="grid max-w-3xl gap-4">
        <p className="font-mono text-[10px] text-muted-foreground">{t("intro")}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <Panel
              key={plan.id}
              title={plan.name}
              hint={plan.priceMonthlyUsd === 0 ? "0" : undefined}
            >
              <div className="flex flex-col gap-2 text-xs">
                <p className="font-mono">
                  {plan.priceMonthlyUsd === null
                    ? t("comingSoon")
                    : plan.priceMonthlyUsd === 0
                      ? t("unlimited")
                      : `$${plan.priceMonthlyUsd}`}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">{plan.tagline}</p>

                <p className="mt-2 font-mono text-[10px] text-muted-foreground uppercase">
                  {t("featuresTitle")}
                </p>
                <ul className="flex flex-col gap-1 font-mono text-[10px]">
                  {plan.features.ai ? <li>{t("featureAi")}</li> : null}
                  {plan.features.mcp ? <li>{t("featureMcp")}</li> : null}
                  {plan.features.exports ? <li>{t("featureExports")}</li> : null}
                  {plan.features.teams ? <li>{t("featureTeams")}</li> : null}
                </ul>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {t("featureExports")}: {formatLimit(plan.limits.cvExports)}
                </p>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </main>
  );
}
