"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { updateJobAction } from "@/server/career/actions";

/**
 * Set the next action and its date (ADR-114).
 *
 * A field you can read but not write is a field nobody fills in, and the whole point of the
 * reference tracker was that the next step is written down. Free text, because "email Sarah about
 * the referral deadline" and "re-apply after the freeze lifts" are not the same kind of thing and a
 * select would force one of them to be wrong.
 *
 * The date is optional on purpose: "someday" is a real answer, and forcing a date would turn a real
 * intention into a fabricated deadline.
 */
export function NextActionForm({
  applicationId,
  initialAction,
  initialDue,
}: {
  applicationId: string;
  initialAction: string;
  /** `YYYY-MM-DD`, or "" — the input type a `<input type="date">` speaks. */
  initialDue: string;
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Career");
  const [action, setAction] = useState(initialAction);
  const [due, setDue] = useState(initialDue);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    if (action.trim() === "") return;
    setBusy(true);
    setStatus(null);
    const result = await updateJobAction({
      applicationId,
      nextAction: action.trim(),
      // A date input gives `YYYY-MM-DD`; an empty field means no date, not today.
      nextActionDue: due === "" ? null : new Date(`${due}T12:00:00`),
    });
    setBusy(false);
    setStatus(
      result.ok
        ? { ok: true, text: t("nextActionSaved") }
        : { ok: false, text: result.message ?? t("saveFailed") },
    );
    if (result.ok) router.refresh();
  };

  return (
    <div className="mt-2 grid gap-2" data-slot="next-action-form">
      <label className="grid gap-1">
        <span className="sr-only">{t("nextAction")}</span>
        <input
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder={t("nextActionPlaceholder")}
          className="h-8 rounded-[var(--radius)] border border-border bg-background px-2 font-mono text-xs"
          aria-label={t("nextAction")}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="grid gap-1">
          <span className="sr-only">{t("dueOnLabel", { date: "" }).trim()}</span>
          <input
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
            className="h-8 rounded-[var(--radius)] border border-border bg-background px-2 font-mono text-[10px]"
            aria-label={t("nextActionDue")}
          />
        </label>
        <Button type="button" size="sm" onClick={save} disabled={busy || action.trim() === ""}>
          {busy ? t("saving") : t("saveNextAction")}
        </Button>
        {status ? (
          <span
            role="status"
            className={
              status.ok
                ? "font-mono text-[10px] text-muted-foreground"
                : "font-mono text-[10px] text-destructive"
            }
          >
            {status.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
