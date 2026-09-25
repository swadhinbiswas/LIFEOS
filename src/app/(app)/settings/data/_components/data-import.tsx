"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { importDataAction } from "@/server/data/actions";
import type { ImportReport } from "@/server/data/import";

/**
 * Import a LifeOS JSON export (spec §10, ADR-083). The file is read in the browser and sent as text
 * to a Server Action; the report names exactly what was restored and what was skipped.
 */
export function DataImport() {
  const t = useTranslations("Pages.Data");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");

  return (
    <div className="flex flex-col gap-2" data-slot="data-import">
      <p className="font-mono text-[10px] text-muted-foreground">{t("importIntro")}</p>
      <label className="sr-only" htmlFor="data-import-file">
        {t("importButton")}
      </label>
      <input
        id="data-import-file"
        type="file"
        accept="application/json,.json"
        disabled={busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError("");
          setReport(null);
          const contents = await file.text();
          const result = await importDataAction({ contents });
          setBusy(false);
          if (result.ok) {
            setReport(result.report);
            router.refresh();
          } else {
            setError(result.message);
          }
        }}
        className="font-mono text-xs"
      />
      {busy ? (
        <span className="font-mono text-[10px] text-muted-foreground">{t("importing")}</span>
      ) : null}
      {report ? (
        <span role="status" className="font-mono text-[10px] text-success">
          {t("importReport", {
            notes: report.notes,
            cards: report.cards,
            habits: report.habits,
            goals: report.goals,
          })}
          {report.skipped.length > 0
            ? ` · ${t("importSkipped", { list: report.skipped.join(", ") })}`
            : ""}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="font-mono text-[10px] text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
