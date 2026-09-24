"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/config/i18n";
import { setLocaleAction } from "@/server/i18n/actions";

/**
 * Locale switch (spec §6.9, ADR-053). The cookie is the source of truth, so choosing a language
 * is a write followed by a refresh; the active language is marked with `aria-pressed`, not colour.
 */
export function LocaleSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const choose = async (next: Locale) => {
    setBusy(true);
    await setLocaleAction({ locale: next });
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2" data-slot="locale-switch">
      {LOCALES.map((candidate) => (
        <Button
          key={candidate}
          type="button"
          variant={candidate === locale ? "default" : "outline"}
          size="sm"
          disabled={busy}
          aria-pressed={candidate === locale}
          onClick={() => void choose(candidate)}
        >
          {LOCALE_NAMES[candidate]}
        </Button>
      ))}
    </div>
  );
}
