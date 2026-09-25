"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cancelDeletionAction, requestDeletionAction } from "@/server/data/actions";
import type { DeletionStatus } from "@/server/data/account";

/**
 * Delete-account controls (spec §10, ADR-083). A request only schedules the purge; cancelling is one
 * click and always available until the grace period ends.
 */
export function DataDelete({ status }: { status: DeletionStatus }) {
  const t = useTranslations("Pages.Data");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async (call: () => Promise<unknown>) => {
    setBusy(true);
    await call();
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2" data-slot="data-delete">
      <p className="font-mono text-[10px] text-muted-foreground">{t("deleteIntro")}</p>
      <p className="font-mono text-[10px]" data-slot="deletion-status">
        {status.purgeAfter
          ? t("deleteScheduled", { date: status.purgeAfter.toISOString().slice(0, 10) })
          : t("deleteNone")}
      </p>
      <div>
        {status.requestedAt ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run(cancelDeletionAction)}
            data-slot="cancel-deletion"
          >
            {t("deleteCancel")}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run(requestDeletionAction)}
            data-slot="request-deletion"
          >
            {t("deleteRequest")}
          </Button>
        )}
      </div>
    </div>
  );
}
