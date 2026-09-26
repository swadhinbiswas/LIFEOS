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
 * Stage, as a select over the pipeline's own columns.
 *
 * The options are the board's real columns rather than a hardcoded list, because a user who renamed
 * a stage must not find the table offering a name their board does not have. The write goes through
 * `moveJobToStageAction`, which resolves the name against the job board at the moment of the call.
 */
export function InlineStage({
  applicationId,
  value,
  stages,
}: {
  applicationId: string;
  value: string;
  stages: string[];
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
        className={`${controlCellSelect} w-full ${cellState(busy, error)}`}
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
export function InlineProgress({
  applicationId,
  value,
}: {
  applicationId: string;
  value: number | null;
}) {
  const t = useTranslations("Pages.Career");
  const initial = value ?? 0;
  const {
    value: current,
    setValue,
    busy,
    error,
    commit,
    edited,
  } = useInline(initial, async (next: number) => {
    const result = await updateJobAction({ applicationId, progress: next });
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  });
  // The slider rests at zero because a range input has no empty state, so the meter above it is what
  // distinguishes "not recorded" from "recorded as nothing done yet". Drawing `░░░░░░░░░░ 0%` for an
  // application nobody has scored is a measurement that was never taken.
  const recorded = value !== null || edited;

  return (
    <span className="grid w-32 gap-1" data-slot="inline-progress">
      {recorded ? (
        <AsciiMeter
          value={current / 100}
          label={t("dbProgressOf", { count: current })}
          cells={10}
          className="text-[10px]"
        />
      ) : (
        <span className="text-[10px] text-muted-foreground">{t("dbUnset")}</span>
      )}
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={current}
        disabled={busy}
        aria-label={t("dbProgress")}
        onChange={(event) => setValue(Number(event.target.value))}
        onPointerUp={() => void commit(current)}
        onKeyUp={() => void commit(current)}
        onBlur={() => void commit(current)}
        // The track is drawn thin and muted with a `primary` thumb, because the default range input
        // on this theme is a thick grey slab that sat directly under the ASCII meter and the two
        // read as one mark rather than a readout and a control. Both pseudo-elements are styled
        // because the track and thumb are UA-drawn and unstyleable with `accent-color` alone.
        className={cn(
          "h-1 w-full cursor-pointer appearance-none rounded-full bg-muted",
          "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
          "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background",
          "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary",
          "[&::-moz-range-thumb]:bg-primary",
          "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
          cellState(busy, error),
        )}
      />
      {error ? (
        <span role="alert" className="text-[10px] text-warning">
          {error}
        </span>
      ) : null}
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
