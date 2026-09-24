"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Kbd } from "@/components/tui/kbd";
import { enqueue } from "@/lib/capture-queue";
import type { ParsedCapture } from "@/server/capture";
import { captureTaskAction, previewCaptureAction } from "@/server/capture/actions";
import { boardQueryKey } from "./use-board";

const dayLabel = (date: Date | null): string =>
  date
    ? new Date(date).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

/**
 * Quick-capture box (spec §4.3 grammar: `buy milk tomorrow 5pm #home !2`). The preview is the
 * server parser's own output, refreshed as you type, so what you see is what gets saved.
 */
export function CaptureBox({
  boardId,
  columnName = "Inbox",
}: {
  boardId: string;
  columnName?: string;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("Pages.Capture");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedCapture | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return; // no preview offline
    const timer = setTimeout(() => {
      void previewCaptureAction({ text: trimmed })
        .then((result) => {
          if (result.ok) setPreview(result.data);
        })
        .catch(() => {
          /* offline mid-typing — the preview is a nicety, never an error */
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [text]);

  const shown = text.trim() === "" ? null : preview;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed === "") return;
    setBusy(true);
    setError("");

    const queueIt = () => {
      enqueue({ text: trimmed, columnName });
      setPreview(null);
      setText("");
    };

    // Offline (ADR-051): hold it in the queue and let the shell replay it on reconnect.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueIt();
      setBusy(false);
      return;
    }

    try {
      const result = await captureTaskAction({ text: trimmed, columnName });
      setBusy(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPreview(null);
      setText("");
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
    } catch {
      // The connection dropped mid-request; keep the capture rather than lose it.
      queueIt();
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1" data-slot="capture-box">
      <label className="sr-only" htmlFor="capture-input">
        {t("label")}
      </label>
      <input
        id="capture-input"
        data-new-item=""
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t("placeholder")}
        autoComplete="off"
        className="border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground"
      />

      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
        {shown ? (
          <>
            <span>{t("adds")}</span>
            <span className="text-foreground">
              {shown.title === "" ? t("tagsOnly") : shown.title}
            </span>
            {shown.dueAt ? (
              <span className="text-info">
                {t("due")} {dayLabel(shown.dueAt)}
              </span>
            ) : null}
            {shown.priority ? <span className="text-warning">{shown.priority}</span> : null}
            {shown.tags.map((tag) => (
              <span key={tag} className="text-primary">
                #{tag}
              </span>
            ))}
            {shown.uncertain.length > 0 ? (
              <span className="text-warning">
                {t("uncertain")} {shown.uncertain.join(", ")}
              </span>
            ) : null}
          </>
        ) : (
          <span>
            <Kbd>Enter</Kbd> {t("enterToAdd")} · {t("date")}{" "}
            <span className="text-primary">#label</span>,{" "}
            <span className="text-warning">!priority</span>
          </span>
        )}
        {error ? (
          <span role="alert" className="text-destructive">
            {error}
          </span>
        ) : null}
        {busy ? <span role="status">{t("saving")}</span> : null}
      </div>
    </form>
  );
}
