import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { getRegionalSettings } from "@/server/settings";

import { ProfileForm } from "./_components/profile-form";
import { RegionalForm } from "./_components/regional-form";

export const metadata = { title: "Profile" };

/**
 * Profile (spec §13 Phase 1 settings): the fields Better Auth owns today. Locale/timezone/
 * week-start columns exist (ERD §2.1) but ship with the phase that consumes them — no dead
 * controls (spec §1). This read re-checks the session itself (ADR-026), not just the layout.
 */
export default async function SettingsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Settings");
  const joined = new Date(session.user.createdAt).toISOString().slice(0, 10);
  const { timeZone, weekStart } = await getRegionalSettings(session.user.id);

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid max-w-3xl gap-4">
        <Panel title={t("account")}>
          <ProfileForm name={session.user.name} email={session.user.email} joined={joined} />
        </Panel>
        <Panel title={t("regional")}>
          <p className="font-mono text-[10px] text-muted-foreground">{t("regionalHint")}</p>
          <RegionalForm timeZone={timeZone} weekStart={weekStart} />
        </Panel>
      </div>
    </>
  );
}
