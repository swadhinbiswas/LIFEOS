import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { listCredentials } from "@/server/ai/credentials";
import { isEncryptionConfigured } from "@/server/ai/crypto";
import { listMemories } from "@/server/ai/memory";
import { usageThisMonth } from "@/server/ai/usage";
import { getServerSession } from "@/server/auth/session";
import { getAiPrefs } from "@/server/settings";

import { AiMemory } from "./_components/ai-memory";
import { AiSettingsForm } from "./_components/ai-settings-form";

export const metadata = { title: "AI" };

/**
 * `/settings/ai` (spec §8/§10): provider, model, BYO key, auto-approve allowlist, memory and the
 * proactive options, plus this month's usage. The key never leaves the server after saving.
 */
export default async function AiSettingsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.AiSettings");
  const [prefs, credentials, usage, memories] = await Promise.all([
    getAiPrefs(session.user.id),
    listCredentials(session.user.id),
    usageThisMonth(session.user.id),
    listMemories(session.user.id),
  ]);

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid max-w-3xl gap-4">
        <Panel title={t("title")}>
          <AiSettingsForm
            prefs={prefs}
            credentials={credentials}
            encryptionOn={isEncryptionConfigured()}
            usage={usage}
          />
        </Panel>

        <Panel title={t("memoryTitle")} hint={`${memories.length}`}>
          <AiMemory items={memories} />
        </Panel>
      </div>
    </>
  );
}
