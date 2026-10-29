import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { getUserDayKey } from "@/server/settings";
import { allDimensionProgress, listPlans } from "@/server/growth";

import { GrowthView } from "./_components/growth-view";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Growth", "title");
}

export default async function GrowthPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const today = await getUserDayKey(session.user.id);
  const [plans, progress] = await Promise.all([
    listPlans(session.user.id),
    allDimensionProgress(session.user.id, today),
  ]);

  return (
    <>
      <PageHeader title="Growth" count={plans.length} />

      <div className="grid max-w-4xl gap-4">
        <Panel title="Life dimensions">
          <GrowthView plans={plans} progress={progress} />
        </Panel>
      </div>
    </>
  );
}
