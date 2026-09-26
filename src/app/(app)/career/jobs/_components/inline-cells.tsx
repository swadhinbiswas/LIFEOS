"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "cn";

import { AsciiMeter } from "@/components/tui/ascii-meter";
import { TuiCheckbox } from "@/components/tui/checkbox";
import { controlCell, controlCellSelect } from "@/components/tui/controls";
import { moveJobToStageAction, updateJobAction } from "@/server/career/actions";

/**
 * Editable cells for the applications table (ADR-127).
 *
 * Every column the table shows is writable from the table. A tracker row you can only read is a
 * report, and the moment the data changes you are back on the job's own page with a form — which is
 * the habit the table was meant to remove.
 *
 * The rule these share: **optimistic locally, committed on intent, `router.refresh()` to reconcile.**
 * Typing has to appear instantly or the field feels broken, but a server action per keystroke is
 * absurd. So the value is local state, the write fires on blur / Enter / pointer-release, and the
 * refresh re-reads the row from the read model so the table can never drift from the database.
 *
 * A failed write says so in the cell and reverts on the next refresh, rather than swallowing it: an
 * optimistic update that silently loses an edit is worse than one that visibly complains.
 */
/** Shared plumbing: local value, one in-flight write, and a status to show failure. */
function useInline<T>(initial: T, save: (value: T) => Promise<{ ok: boolean; message?: string }>) {
  const router = useRouter();
  const t = useTranslations("Pages.Career");
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Whether the user has touched this field since the last server value. State rather than a
  // comparison against the ref below, because a ref read during render is what the compiler lint
  // (correctly) refuses: the value it holds is not something the render can depend on.
  const [edited, setEdited] = useState(false);
  // The last value the server is known to hold. Only read in effects and handlers, never in render.
  // It is what makes a redundant commit a no-op: the slider's pointer-up and then blur are one edit,
  // not two writes.
  const committed = useRef(initial);
  useEffect(() => {
    // Adopt the server's value only while the field holds nothing the user has typed. Yanking a
    // half-typed next action out from under the cursor to replace it with a stale prop is worse
    // than showing a value that is a few seconds old.
    setValue((current) => (current === committed.current ? initial : current));
    committed.current = initial;
    setEdited(false);
  }, [initial]);

  /** The only way a cell's value changes, so `edited` cannot be forgotten at a call site. */
  const change = useCallback((next: T) => {
    setValue(next);
    setEdited(true);
  }, []);

  const commit = useCallback(
    async (next: T) => {
      if (busy || next === committed.current) return;
      setBusy(true);
      setError(null);
      const result = await save(next);
      setBusy(false);
      if (result.ok) {
        committed.current = next;
        router.refresh();
      } else {
        setError(result.message ?? t("saveFailed"));
      }
    },
    [busy, router, save, t],
  );

  return { value, setValue: change, busy, error, commit, edited };
}

/**
 * A stage colour token, as a class. Written out rather than constructed: `text-${token}` is
 * assembled at runtime, and Tailwind only emits classes it can see written down, so the constructed
 * form silently produces no rule at all. Every token a template may name is a key here.
 */
const STAGE_TEXT: Record<string, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
  "muted-foreground": "text-muted-foreground",
  foreground: "text-foreground",
};

/**
 * The dropdown marker. `appearance-none` took the platform's arrow away, so one is drawn — as a
 * glyph on the text baseline, the same `▾` `TuiSelect` uses, rather than a gradient assembled from
 * two 45° stops that renders at a different offset on every engine.
 */
function Caret() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 font-mono text-[10px] text-muted-foreground"
    >
      ▾
    </span>
  );
}

/** The cell border goes amber when a write failed, so the failure is attached to the cell that lost it. */
const cellState = (busy: boolean, error: string | null) =>
  busy ? "opacity-60" : error ? "border-warning" : "";

/**
 * Stage, as a select over the pipeline's own columns, **in that column's own colour**.
 *
 * The options are the board's real columns rather than a hardcoded list, because a user who renamed
 * a stage must not find the table offering a name their board does not have. The write goes through
 * `moveJobToStageAction`, which resolves the name against the job board at the moment of the call.
 *
 * The colour is a **theme token name** stored on the column, not a hex, so a stage reads the same in
 * every theme and a renamed or hand-made column simply has none. It cannot be applied as
 * `text-${color}`: Tailwind scans source for complete class names, so a constructed one is invisible
 * to the compiler and the class never exists. Hence the lookup — the same trick as `FIT_CLASS`.
 */
export function InlineStage({
  applicationId,
  value,
  stages,
  color,
}: {
  applicationId: string;
  value: string;
  stages: string[];
  /** The current stage's token name, from `board_columns.color`. */
  color: string | null;
}) {
  const t = useTranslations("Pages.Career");
  const {
    value: current,
    setValue,
    busy,
    error,
    commit,
  } = useInline(value, async (next: string) => {
    const result = await moveJobToStageAction({ applicationId, toStage: next });
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  });

  return (
    <span className="relative grid gap-0.5" data-slot="inline-stage">
      <select
        aria-label={t("dbStage")}
        value={current}
        disabled={busy}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          void commit(next);
        }}
        className={cn(
          controlCellSelect,
          "w-full",
          // The selected stage's own colour, so the row says where it is without being read. The
          // caret stays muted: it is a control affordance, not part of the answer.
          STAGE_TEXT[color ?? ""],
          cellState(busy, error),
        )}
      >
        {stages.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <Caret />
      {error ? (
        <span role="alert" className="text-[10px] text-warning">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Progress, as a slider.
 *
 * The local value tracks the pointer so the thumb follows the hand, but the write waits for the
 * release: a range input's change event fires continuously while dragging, and firing a server
 * action per pixel would be both slow and wrong (a half-finished drag is not a decision).
 */
/**
 * Progress, derived from the stage and therefore **read-only** (ADR-128).
 *
 * This was a slider, and that was the wrong control. Progress is a *consequence* of which column
 * the card is in: a card in Offer is further along than one in Applied, whatever anybody types. A
 * manual control for it is a second source of truth for a number the stage already determines, and
 * the two drift — you move a card to Offer and the meter still says 30 because nobody dragged it.
 * The same argument that made `fit` a derived band (ADR-114) applies here, and it applies harder,
 * because unlike a fit score nobody has an independent opinion about how far through a pipeline a
 * card is. To change it, change the stage.
 *
 * `null` is not zero. A stage that is an outcome rather than a step — Rejected, Withdrawn — has no
 * percentage, and drawing a meter for it would put a number on the end of a process.
 */
export function StageProgress({ value }: { value: number | null }) {
  const t = useTranslations("Pages.Career");
  if (value === null) {
    return (
      <span className="text-[10px] text-muted-foreground" data-slot="stage-progress">
        {t("dbNotAPercentage")}
      </span>
    );
  }
  return (
    <span className="grid w-32 gap-0.5" data-slot="stage-progress">
      <AsciiMeter
        value={value / 100}
        label={t("dbProgressOf", { count: value })}
        cells={10}
        className="text-[10px]"
      />
    </span>
  );
}

/** A column whose schema is a fixed set rather than free text — seniority, today. */
export function InlineEnum({
  applicationId,
  field,
  value,
  options,
  label,
}: {
  applicationId: string;
  field: "seniority";
  value: string | null;
  /** `(stored value, shown label)` — the stored value is what Zod checks. */
  options: Array<[string, string]>;
  label: string;
}) {
  const t = useTranslations("Pages.Career");
  const {
    value: current,
    setValue,
    busy,
    error,
    commit,
  } = useInline(value ?? "", async (next: string) => {
    const result = await updateJobAction({ applicationId, [field]: next === "" ? null : next });
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  });

  return (
    <span className="relative grid gap-0.5">
      <select
        aria-label={label}
        value={current}
        disabled={busy}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          void commit(next);
        }}
        className={`${controlCellSelect} w-full ${cellState(busy, error)}`}
      >
        <option value="">{t("dbNone")}</option>
        {options.map(([stored, shown]) => (
          <option key={stored} value={stored}>
            {shown}
          </option>
        ))}
      </select>
      <Caret />
      {error ? (
        <span role="alert" className="text-[10px] text-warning">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** Fit, as a 0–100 score. Typed, not a band select: the band is derived, the score is the fact. */
export function InlineFit({
  applicationId,
  value,
}: {
  applicationId: string;
  value: number | null;
}) {
  const t = useTranslations("Pages.Career");
  const {
    value: current,
    setValue,
    busy,
    error,
    commit,
  } = useInline<number | null>(value, async (next) => {
    const result = await updateJobAction({ applicationId, fitScore: next });
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  });

  return (
    <span className="grid w-20 gap-0.5">
      <input
        type="number"
        min={0}
        max={100}
        // `null` renders as an empty field. An emptied box commits `null` — clearing a score is a
        // real edit, and coercing it to 0 would file "undecided" as "decided, and it is a zero".
        value={current ?? ""}
        placeholder={t("dbUnset")}
        disabled={busy}
        aria-label={t("dbFit")}
        onChange={(event) =>
          setValue(event.target.value === "" ? null : Number(event.target.value))
        }
        onBlur={() => void commit(current)}
        onKeyUp={(event) => {
          if (event.key === "Enter") void commit(current);
        }}
        className={`${controlCell} w-full tabular-nums ${cellState(busy, error)}`}
      />
      {error ? (
        <span role="alert" className="text-[10px] text-warning">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** Any short text cell: commits on blur or Enter, never on a keystroke. */
export function InlineText({
  applicationId,
  field,
  value,
  label,
  placeholder,
}: {
  applicationId: string;
  /**
   * A key of `updateJobInput` — the only thing this writes. Named explicitly rather than accepted as
   * a loose string because a typo in a column's field name compiles, renders, and silently writes
   * the wrong column: `field="location"` on the company cell overwrote every application's city.
   *
   * `seniority` is deliberately absent: it is a Zod enum, so free text would be rejected for
   * anything but its four values. It gets {@link InlineEnum} instead.
   */
  field: "appId" | "location" | "nextAction" | "companyName";
  value: string | null;
  label: string;
  placeholder?: string;
}) {
  const {
    value: current,
    setValue,
    busy,
    error,
    commit,
  } = useInline(value ?? "", async (next: string) => {
    const result = await updateJobAction({ applicationId, [field]: next === "" ? null : next });
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  });

  return (
    <span className="grid gap-0.5">
      <input
        type="text"
        value={current}
        disabled={busy}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit(current)}
        onKeyUp={(event) => {
          if (event.key === "Enter") void commit(current);
        }}
        className={`${controlCell} w-full ${cellState(busy, error)}`}
      />
      {error ? (
        <span role="alert" className="text-[10px] text-warning">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** The cover-letter flag: a checkbox, because the answer is a yes or a no and nothing else. */
export function InlineCoverLetter({
  applicationId,
  value,
}: {
  applicationId: string;
  value: boolean | null;
}) {
  const t = useTranslations("Pages.Career");
  const {
    value: current,
    setValue,
    busy,
    commit,
  } = useInline(value === true, async (next: boolean) => {
    const result = await updateJobAction({ applicationId, coverLetterNeeded: next });
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  });

  return (
    <span className={busy ? "opacity-60" : ""}>
      <TuiCheckbox
        checked={current}
        onCheckedChange={(next) => {
          setValue(next);
          void commit(next);
        }}
        aria-label={t("dbCoverLetter")}
      >
        {t("dbClNeeded")}
      </TuiCheckbox>
    </span>
  );
}
