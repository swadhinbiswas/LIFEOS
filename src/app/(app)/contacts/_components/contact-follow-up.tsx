"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { updateContactFollowUpAction } from "@/server/contacts/actions";

/**
 * Discharge a promise, or make a new one (ADR-132).
 *
 * "Done" and "remind me Thursday" are the only two things anybody does with a person they owe a
 * reply to, so they are the only two controls. Everything else about this row — when it was
 * promised, who they are, how late it is — is already on screen and none of it is editable,
 * because none of it is a decision anybody makes twice.
 *
 * The delay options are a fixed set rather than a date picker: the choices that get made are "in a
 * couple of days", "next week", "next month", and a picker is two gestures to express one of four
 * intents.
 */
export function ContactFollowUp({ contactId, name }: { contactId: string; name: string }) {
  const router = useRouter();
  const t = useTranslations("Pages.Contacts");
  const [busy, setBusy] = useState(false);

  const send = async (days: number | null) => {
    setBusy(true);
    await updateContactFollowUpAction({
      contactId,
      followUpAt: days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    });
    setBusy(false);
    router.refresh();
  };

  return (
    <span className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void send(null)}
        data-slot="follow-up-done"
        aria-label={t("followUpDone", { name })}
      >
        {t("followUpDoneShort")}
      </Button>
      <label className="flex items-center gap-1">
        <span className="sr-only">{t("followUpRemind", { name })}</span>
        <select
          aria-label={t("followUpRemind", { name })}
          disabled={busy}
          value=""
          data-slot="follow-up-remind"
          onChange={(event) => {
            const days = Number(event.target.value);
            if (!Number.isFinite(days) || days <= 0) return;
            void send(days);
          }}
          className="min-h-7 rounded-[var(--radius)] border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {/* The empty option is the control's resting state, so the value is always a real choice
              and never a pre-filled date nobody chose. */}
          <option value="">{t("followUpRemindShort")}</option>
          <option value={2}>{t("followUpInDays", { count: 2 })}</option>
          <option value={7}>{t("followUpInDays", { count: 7 })}</option>
          <option value={30}>{t("followUpInDays", { count: 30 })}</option>
        </select>
      </label>
    </span>
  );
}
