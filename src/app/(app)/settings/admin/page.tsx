import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { isAdmin, listUsers } from "@/server/admin";

import { AdminSettingsForm } from "./_components/admin-settings-form";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.AdminSettings", "title");
}

export default async function AdminSettingsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");
  if (!(await isAdmin(session.user.id))) redirect("/settings");

  const users = await listUsers();

  return (
    <>
      <PageHeader title="Admin" count={users.length} />

      <div className="grid max-w-3xl gap-4">
        <Panel title="Accounts">
          <AdminSettingsForm users={users} currentUserId={session.user.id} />
        </Panel>
      </div>
    </>
  );
}
