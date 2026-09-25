import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getConversationMessages, listConversations } from "@/server/ai/conversations";
import { resolveModel } from "@/server/ai/providers";
import { getServerSession } from "@/server/auth/session";
import { getAiPrefs } from "@/server/settings";

import { CopilotChat } from "./_components/copilot-chat";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Copilot", "title");
}

/**
 * `/ai` (spec §8): the full-page copilot. The server decides whether a provider is usable and
 * loads the most recent conversation, so the page shows either a working chat or an honest
 * "configure a provider" state — never a chat box that cannot answer.
 */
export default async function AiPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Copilot");
  const prefs = await getAiPrefs(session.user.id);
  const [resolved, conversations] = await Promise.all([
    resolveModel(session.user.id, prefs),
    listConversations(session.user.id),
  ]);

  const latest = conversations[0];
  const messages = latest ? await getConversationMessages(session.user.id, latest.id) : null;

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid max-w-3xl gap-4">
        <p className="font-mono text-[10px] text-muted-foreground">{t("tagline")}</p>

        <Panel title={t("title")} hint={resolved ? resolved.source : undefined}>
          {resolved ? (
            resolved.source === "scripted" ? (
              <div className="flex flex-col gap-3">
                <p className="font-mono text-[10px] text-warning">{t("scripted")}</p>
                <CopilotChat conversationId={latest?.id} initialMessages={messages ?? undefined} />
              </div>
            ) : (
              <CopilotChat conversationId={latest?.id} initialMessages={messages ?? undefined} />
            )
          ) : (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs text-muted-foreground">{t("noProvider")}</p>
              <Link href="/settings/ai" className="font-mono text-xs text-primary hover:underline">
                {t("openSettings")}
              </Link>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
