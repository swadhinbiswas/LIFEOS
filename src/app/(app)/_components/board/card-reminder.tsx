"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  clearCardReminderAction,
  getCardReminderAction,
  setCardReminderAction,
} from "@/server/reminders/actions";

const reminderKey = (cardId: string) => ["card-reminder", cardId] as const;

/** `datetime-local` needs local wall-clock, so convert the stored UTC instant for the input. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Per-card reminder (spec §6.9 / #28, ADR-054). One pending reminder per card; the notification
 * sweep delivers it when the time passes. Loaded on sheet open like the goal links, so the sheet
 * carries no reminder data of its own.
 */
export function CardReminder({ cardId }: { cardId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("Pages.Board");
  const [draft, setDraft] = useState("");

  const reminder = useQuery({
    queryKey: reminderKey(cardId),
    queryFn: async () => {
      const result = await getCardReminderAction({ cardId });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  const afterChange = () => {
    setDraft("");
    void queryClient.invalidateQueries({ queryKey: reminderKey(cardId) });
  };

  const save = useMutation({
    mutationFn: async (fireAt: string) => {
      const result = await setCardReminderAction({ cardId, fireAt: new Date(fireAt) });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: afterChange,
  });

  const clear = useMutation({
    mutationFn: async () => {
      const result = await clearCardReminderAction({ cardId });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: afterChange,
  });

  const current = reminder.data;
  const value = draft || (current ? toLocalInput(current.fireAt) : "");

  return (
    <div className="flex flex-col gap-1" data-slot="card-reminder">
      <span className="font-mono text-xs text-muted-foreground">{t("remindMe")}</span>
      <p data-slot="card-reminder-current" className="font-mono text-[10px] text-muted-foreground">
        {current
          ? t("reminderSet", { when: toLocalInput(current.fireAt).replace("T", " ") })
          : t("noReminder")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="card-reminder-at">
          {t("remindMeAt")}
        </label>
        <input
          id="card-reminder-at"
          type="datetime-local"
          value={value}
          onChange={(event) => setDraft(event.target.value)}
          className="h-8 border border-border bg-background px-2 font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={save.isPending || value === ""}
          onClick={() => save.mutate(value)}
        >
          {t("set")}
        </Button>
        {current ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={clear.isPending}
            onClick={() => clear.mutate()}
          >
            {t("clear")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
