import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { listAccounts } from "@/server/finance";
import { listPlans } from "@/server/finance/obligations";

import { ObligationsView } from "./_components/obligations-view";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Finance", "title");
}

export default async function ObligationsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const [plans, accounts] = await Promise.all([
    listPlans(session.user.id),
    listAccounts(session.user.id),
  ]);

  // Generate occurrences for each plan
  const plansWithOccurrences = await Promise.all(
    plans.map(async (plan) => {
      const { listOccurrences } = await import("@/server/finance/obligations");
      const occurrences = await listOccurrences(session.user.id, plan.id);
      return { plan, occurrences };
    }),
  );

  return (
    <>
      <PageHeader title="Obligations" />

      <div className="grid max-w-4xl gap-4">
        <Panel title="Debts & credits">
          <ObligationsView plans={plansWithOccurrences} accounts={accounts} />
        </Panel>
      </div>
    </>
  );
}
