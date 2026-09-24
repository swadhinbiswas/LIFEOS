"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteSubscriptionAction, markSubscriptionRenewedAction } from "@/server/finance/actions";

/**
 * Per-row subscription controls (ADR-050). "Renewed" advances the date by one cadence through the
 * service; both buttons refresh so the panel (and the notification nudge) read the new state.
 */
export function SubscriptionControls({
  subscriptionId,
  name,
}: {
  subscriptionId: string;
  name: string;
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Finance");
  const [busy, setBusy] = useState(false);

  const run = async (call: () => Promise<{ ok: boolean }>) => {
    setBusy(true);
    await call();
    setBusy(false);
    router.refresh();
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void run(() => markSubscriptionRenewedAction({ subscriptionId }))}
      >
        {t("renewed")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        aria-label={t("deleteAria", { name })}
        onClick={() => void run(() => deleteSubscriptionAction({ subscriptionId }))}
      >
        {t("delete")}
      </Button>
    </>
  );
}
