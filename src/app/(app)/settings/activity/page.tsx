import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getConnection } from "@/server/activity/wakatime";
import { isEncryptionConfigured } from "@/server/ai/crypto";
import { getServerSession } from "@/server/auth/session";

import { WakaTimeForm } from "./_components/wakatime-form";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Activity", "title");
}

/**
 * The install snippet for each sender (ADR-124).
 *
 * These are **not** in the message catalogue, and that is the whole point. A message string is an
 * ICU MessageFormat template, so a `{` in it opens a placeholder — and the OpenCode plugin's config
 * is JSON, which is nothing but braces. It shipped as a message for exactly that long, and the
 * result was a server render failing with `MALFORMED_ARGUMENT` on `/settings/activity`. Quoting the
 * braces (`{'{'}`) does not rescue it either: the parser still walks the quoted region looking for
 * a closing brace and the JSON's own `}` ends it early.
 *
 * A shell command and a JSON document are not translatable prose. Keeping them here means a
 * translator cannot mangle a command, and it removes the entire class of bug rather than escaping
 * one instance of it. The prose around them — the name and the hint — stays in the catalogue,
 * because that genuinely is copy.
 *
 * `as const` so a typo in a sender id is a compile error rather than a silently missing key.
 */
const SENDERS = [
  {
    id: "cli",
    nameKey: "sender_cli_name",
    hintKey: "sender_cli_hint",
    code: "pipx install wakatime\nwakatime --api-key waka_…",
  },
  {
    id: "opencode",
    nameKey: "sender_opencode_name",
    hintKey: "sender_opencode_hint",
    code: '{\n  "$schema": "https://opencode.ai/config.json",\n  "plugin": ["@wakatime/opencode-wakatime"]\n}',
  },
  {
    id: "phone",
    nameKey: "sender_phone_name",
    hintKey: "sender_phone_hint",
    code: "install the wakatime app\n→ sign in with the same account",
  },
] as const;

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
            {SENDERS.map((sender, index) => (
              <li key={sender.id} className="grid gap-1">
                {/* One string, not `1. {name}`: two adjacent text nodes in a <p> collapse to
                    "2. opencode plugin" with no element boundary, which no exact matcher can
                    target — the ordinal and the label have to share a node. */}
                <p className="font-mono text-[11px] text-foreground">
                  {t("senderStep", { step: index + 1, name: t(sender.nameKey) })}
                </p>
                <p className="text-xs text-muted-foreground">{t(sender.hintKey)}</p>
                <pre className="overflow-x-auto rounded-[var(--radius)] border border-border bg-muted/40 px-2 py-1.5 font-mono text-[10px] leading-relaxed">
                  {sender.code}
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
