import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { isEncryptionConfigured } from "@/server/ai/crypto";
import { getEmailAccount, getEmailCache } from "@/server/email/accounts";

import { EmailSettingsForm } from "./_components/email-settings-form";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.EmailSettings", "title");
}

export default async function EmailSettingsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const account = await getEmailAccount(session.user.id);
  const cache = await getEmailCache(session.user.id);

  return (
    <>
      <PageHeader title="Email" />

      <div className="grid max-w-3xl gap-4">
        <Panel title="Mailbox">
          <EmailSettingsForm account={account} encryptionOn={isEncryptionConfigured()} />
        </Panel>
        {account && cache ? (
          <Panel title="Recent" hint={`${JSON.parse(cache.messages_json).length}`}>
            <p className="font-mono text-[10px] text-muted-foreground">
              Last fetched {new Date(cache.fetched_at).toLocaleString()}.
            </p>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
