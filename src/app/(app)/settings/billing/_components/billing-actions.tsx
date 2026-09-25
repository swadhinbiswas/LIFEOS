"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Billing actions (spec §11). Only rendered when billing is ready (ADR-082); the checkout is created
 * server-side with the user attached, and the returned hosted URL is where we send the browser.
 */
export function BillingActions() {
  const t = useTranslations("Pages.Billing");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async (plan: "pro" | "team") => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) {
        setError(t("notAvailable"));
        return;
      }
      const data = (await response.json()) as { checkout_url?: string };
      if (data.checkout_url) window.location.href = data.checkout_url;
      else setError(t("notAvailable"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" disabled={busy} onClick={() => void start("pro")}>
        {t("upgradePro")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void start("team")}
      >
        {t("upgradeTeam")}
      </Button>
      {error ? (
        <span role="alert" className="font-mono text-[10px] text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
