import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getConnection } from "@/server/activity/wakatime";
import { isEncryptionConfigured } from "@/server/ai/crypto";
import { getServerSession } from "@/server/auth/session";

import { WakaTimeForm } from "./_components/wakatime-form";

export const metadata = { title: "Activity" };

/**
 * `/settings/activity` (ADR-110): connect WakaTime, sync on demand, and see exactly which senders
 * feed the numbers. The sender list is the verified install instruction for the CLI, the official
 * OpenCode plugin and WakaTime's own mobile app — one account, so all three land here without a
 * separate LifeOS integration each.
 */
export default async function ActivitySettingsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Activity");
  const connection = await getConnection(session.user.id);

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid max-w-3xl gap-4">
        <Panel title={t("connection")}>
          <WakaTimeForm
            connection={
              connection
                ? {
                    hint: connection.hint,
                    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
                    lastError: connection.lastError,
                  }
                : null
            }
            encryptionOn={isEncryptionConfigured()}
          />
        </Panel>

        <Panel title={t("senders")}>
          <ol className="grid gap-3">
            {(["cli", "opencode", "phone"] as const).map((sender, index) => (
              <li key={sender} className="grid gap-1">
                {/* One string, not `1. {name}`: two adjacent text nodes in a <p> collapse to
                    "2. opencode plugin" with no element boundary, which no exact matcher can
                    target — the ordinal and the label have to share a node. */}
                <p className="font-mono text-[11px] text-foreground">
                  {t("senderStep", { step: index + 1, name: t(`sender_${sender}_name`) })}
                </p>
                <p className="text-xs text-muted-foreground">{t(`sender_${sender}_hint`)}</p>
                <pre className="overflow-x-auto rounded-[var(--radius)] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] leading-relaxed">
                  {t(`sender_${sender}_code`)}
                </pre>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={t("privacy")}>
          <p className="text-xs text-muted-foreground">{t("privacyHint")}</p>
        </Panel>
      </div>
    </>
  );
}
