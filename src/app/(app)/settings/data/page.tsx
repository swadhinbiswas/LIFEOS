import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { listAudit } from "@/server/ai/audit";
import { getServerSession } from "@/server/auth/session";
import { accountDeletionStatus } from "@/server/data/account";
import { CSV_MODULES } from "@/server/data/export";

import { DataDelete } from "./_components/data-delete";
import { DataImport } from "./_components/data-import";

export const metadata = { title: "Data" };

/**
 * `/settings/data` (spec §10, ADR-083): export, import, delete-account and a read-only audit log.
 * Everything here is the signed-in user's own data; the audit rows are written by the AI (ADR-073)
 * and are never editable.
 */
export default async function DataPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Data");
  const [status, audit] = await Promise.all([
    accountDeletionStatus(session.user.id),
    listAudit(session.user.id, 25),
  ]);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h1>

      <div className="grid max-w-3xl gap-4">
        <Panel title={t("exportTitle")}>
          <p className="font-mono text-[10px] text-muted-foreground">{t("exportIntro")}</p>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            <li>
              <a href="/api/data/export?format=json" className="text-primary hover:underline">
                {t("exportJson")}
              </a>
            </li>
            <li>
              <a href="/api/data/export?format=md" className="text-primary hover:underline">
                {t("exportNotes")}
              </a>
            </li>
            <li>
              <a href="/api/data/export?format=resume" className="text-primary hover:underline">
                {t("exportResume")}
              </a>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{t("exportCsv")}</span>
              {CSV_MODULES.map((csvModule) => (
                <a
                  key={csvModule}
                  href={`/api/data/export?format=csv&module=${csvModule}`}
                  className="text-primary hover:underline"
                >
                  {csvModule}
                </a>
              ))}
            </li>
          </ul>
        </Panel>

        <Panel title={t("importTitle")}>
          <DataImport />
        </Panel>

        <Panel title={t("deleteTitle")}>
          <DataDelete status={status} />
        </Panel>

        <Panel title={t("auditTitle")} hint={`${audit.length}`}>
          {audit.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("auditEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-1" data-slot="audit-list">
              {audit.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-[10px]"
                >
                  <span className="text-primary">{row.actor}</span>
                  <span className="min-w-0 flex-1 truncate">{row.action}</span>
                  <time
                    className="text-muted-foreground tabular-nums"
                    dateTime={row.created_at.toISOString()}
                  >
                    {row.created_at.toISOString().slice(0, 16).replace("T", " ")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
