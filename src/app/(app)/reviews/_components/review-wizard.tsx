"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { completeReviewAction } from "@/server/reviews/actions";

const field =
  "w-full border border-border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground";

/** Guided steps, in the spec's order (clear inbox → boards → goals → wins/lessons → plan next). */
export function ReviewWizard() {
  const router = useRouter();
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
        clear the inbox
      </label>
      <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase">
        <input
          type="checkbox"
          checked={reviewedBoards}
          onChange={(e) => setReviewedBoards(e.target.checked)}
        />
        review the boards
      </label>
      <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase">
        <input
          type="checkbox"
          checked={reviewedGoals}
          onChange={(e) => setReviewedGoals(e.target.checked)}
        />
        review the goals
      </label>

      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        wins
        <textarea
          rows={3}
          value={wins}
          onChange={(e) => setWins(e.target.value)}
          placeholder="what moved forward"
          className={field}
          aria-label="review wins"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        lessons
        <textarea
          rows={3}
          value={lessons}
          onChange={(e) => setLessons(e.target.value)}
          placeholder="what got in the way"
          className={field}
          aria-label="review lessons"
        />
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase">
        next
        <textarea
          rows={3}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="what matters next week"
          className={field}
          aria-label="review next"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground uppercase">
          cadence
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "weekly" | "monthly")}
            className="border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
            aria-label="review cadence"
          >
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
          </select>
        </label>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "saving…" : "complete review"}
        </Button>
        {error ? (
          <span role="alert" className="text-destructive">
            {error}
          </span>
        ) : null}
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        the review is saved as a note, so it is searchable and you can edit it afterwards.
      </p>
    </form>
  );
}
