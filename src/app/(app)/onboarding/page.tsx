import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { BOARD_TEMPLATES } from "@/config/board-templates";
import { getServerSession } from "@/server/auth/session";

import { OnboardingWizard } from "./_components/onboarding-wizard";

export const metadata = { title: "Welcome" };

/**
 * `/onboarding` (spec §14 Phase 8, ADR-085): the 60-second setup. Name → profile → starter board,
 * then the dashboard. The `OnboardingGate` in the shell sends new accounts here once.
 */
export default async function OnboardingPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Onboarding");

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h1>
      <div className="max-w-xl">
        <Panel title={t("title")} hint={t("hint")}>
          <OnboardingWizard name={session.user.name} templates={BOARD_TEMPLATES} />
        </Panel>
      </div>
    </>
  );
}
