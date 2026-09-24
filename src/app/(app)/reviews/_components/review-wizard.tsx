"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { completeReviewAction } from "@/server/reviews/actions";

const field =
  "w-full border border-border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground";

/** Guided steps, in the spec's order (clear inbox → boards → goals → wins/lessons → plan next). */
export function ReviewWizard() {
  const router = useRouter();
  const t = useTranslations("Pages.Reviews");
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [clearedInbox, setClearedInbox] = useState(false);
  const [reviewedBoards, setReviewedBoards] = useState(false);
  const [reviewedGoals, setReviewedGoals] = useState(false);
  const [wins, setWins] = useState("");
  const [lessons, setLessons] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      data-slot="review-wizard"
      className="flex flex-col gap-2 text-xs"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const result = await completeReviewAction({
          period,
          answers: { wins, lessons, next, clearedInbox, reviewedBoards, reviewedGoals },
        });
        setBusy(false);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        router.push(result.data.noteId ? `/notes/${result.data.noteId}` : "/notes");
      }}
    >
      <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase">
        <input
          type="checkbox"
          checked={clearedInbox}
          onChange={(e) => setClearedInbox(e.target.checked)}
        />
        {t("clearInbox")}
      </label>
      <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase">
        <input
          type="checkbox"
          checked={reviewedBoards}
          onChange={(e) => setReviewedBoards(e.target.checked)}
        />
        {t("reviewBoards")}
      </label>
      <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase">
        <input
          type="checkbox"
          checked={reviewedGoals}
          onChange={(e) => setReviewedGoals(e.target.checked)}
        />
        {t("reviewGoals")}
      </label>

      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("wins")}
        <textarea
          rows={3}
          value={wins}
          onChange={(e) => setWins(e.target.value)}
          placeholder={t("winsPlaceholder")}
          className={field}
          aria-label={t("ariaWins")}
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("lessons")}
        <textarea
          rows={3}
          value={lessons}
          onChange={(e) => setLessons(e.target.value)}
          placeholder={t("lessonsPlaceholder")}
          className={field}
          aria-label={t("ariaLessons")}
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        {t("next")}
        <textarea
          rows={3}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={t("nextPlaceholder")}
          className={field}
          aria-label={t("ariaNext")}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground uppercase">
          {t("cadence")}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "weekly" | "monthly")}
            className="border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
            aria-label={t("ariaCadence")}
          >
            <option value="weekly">{t("weekly")}</option>
            <option value="monthly">{t("monthly")}</option>
          </select>
        </label>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? t("saving") : t("complete")}
        </Button>
        {error ? (
          <span role="alert" className="text-destructive">
            {error}
          </span>
        ) : null}
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">{t("hint")}</p>
    </form>
  );
}
