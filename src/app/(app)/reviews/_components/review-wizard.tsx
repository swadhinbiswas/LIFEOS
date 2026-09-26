"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TuiCheckbox } from "@/components/tui/checkbox";
import { TuiSelect } from "@/components/tui/select";
import { completeReviewAction, draftReviewAction } from "@/server/reviews/actions";

/** §4.1: a numbered step, monospace, quiet. The wizard's spine. */
const Step = ({ n, label, children }: { n: number; label: string; children: React.ReactNode }) => (
  <section data-slot="review-step" className="grid gap-1.5">
    <p className="flex items-baseline gap-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
      <span aria-hidden="true" className="text-primary">
        {String(n).padStart(2, "0")}
      </span>
      <span>{label}</span>
    </p>
    {children}
  </section>
);

/**
 * The weekly/monthly review wizard (spec §6.2, ADR-116).
 *
 * Structured as the spec's own five steps rather than a flat form, because "guided" is the word it
 * uses: clear the inbox, review the boards, review the goals, then say what moved, what got in the
 * way, and what matters next. The steps are also the *only* place the three questions live, so the
 * page reads top-to-bottom the way the review is actually thought through.
 *
 * Prose gets a measure. The old textareas ran the full 48rem container width, which is roughly 130
 * characters a line — far past the point where a sentence can be held in one look, and the whole
 * point of the wins/lessons/next fields is that they get read.
 */
export function ReviewWizard({ canDraft }: { canDraft: boolean }) {
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
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState(false);
  const [error, setError] = useState("");

  const draft = async () => {
    setDrafting(true);
    setError("");
    const result = await draftReviewAction({ period });
    setDrafting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    // Filled, not submitted: the user edits before anything is saved (ADR-116).
    setWins(result.data.wins);
    setLessons(result.data.lessons);
    setNext(result.data.next);
    setDrafted(true);
  };

  const submit = async (event: React.FormEvent) => {
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
  };

  return (
    <form
      method="post"
      data-slot="review-wizard"
      className="grid gap-4"
      onSubmit={async (event) => {
        await submit(event);
      }}
    >
      <Step n={1} label={t("stepClear")}>
        <div className="grid gap-0.5 sm:grid-cols-3">
          <TuiCheckbox checked={clearedInbox} onCheckedChange={setClearedInbox}>
            {t("clearInbox")}
          </TuiCheckbox>
          <TuiCheckbox checked={reviewedBoards} onCheckedChange={setReviewedBoards}>
            {t("reviewBoards")}
          </TuiCheckbox>
          <TuiCheckbox checked={reviewedGoals} onCheckedChange={setReviewedGoals}>
            {t("reviewGoals")}
          </TuiCheckbox>
        </div>
      </Step>

      <Step n={2} label={t("stepReflect")}>
        <div className="grid gap-3">
          {(
            [
              ["wins", wins, setWins],
              ["lessons", lessons, setLessons],
              ["next", next, setNext],
            ] as const
          ).map(([key, value, set]) => (
            <label key={key} className="grid gap-1">
              <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                {t(key)}
              </span>
              <Textarea
                rows={3}
                value={value}
                onChange={(event) => set(event.target.value)}
                placeholder={t(`${key}Placeholder`)}
                aria-label={t(`aria${key[0]?.toUpperCase()}${key.slice(1)}`)}
                className="max-w-[46ch] resize-y font-mono text-xs"
              />
            </label>
          ))}
        </div>
      </Step>

      <Step n={3} label={t("stepFinish")}>
        <div className="flex flex-wrap items-end gap-3">
          <TuiSelect
            label={t("cadence")}
            value={period}
            onChange={(event) => setPeriod(event.target.value as "weekly" | "monthly")}
            aria-label={t("ariaCadence")}
            wrapperClassName="min-w-40"
          >
            <option value="weekly">{t("weekly")}</option>
            <option value="monthly">{t("monthly")}</option>
          </TuiSelect>

          {canDraft ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void draft()}
              disabled={drafting || busy}
            >
              {drafting ? t("drafting") : drafted ? t("redraft") : t("draftWithAi")}
            </Button>
          ) : null}

          <Button type="submit" size="sm" disabled={busy || drafting}>
            {busy ? t("saving") : t("complete")}
          </Button>

          {error ? (
            <span role="alert" className="font-mono text-[10px] text-destructive">
              {error}
            </span>
          ) : null}
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">{t("hint")}</p>
      </Step>
    </form>
  );
}
