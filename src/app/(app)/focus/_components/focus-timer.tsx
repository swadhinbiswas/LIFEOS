"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { startFocusAction, stopFocusAction } from "@/server/focus/actions";

const format = (seconds: number): string => {
  const safe = Math.max(0, seconds);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

/**
 * The focus timer (spec §6.7). Elapsed time is computed from the session row's `started_at`, so
 * the clock keeps running across navigation and reloads without any client-side state to lose.
 */
export function FocusTimer({
  sessionId,
  startedAt,
  plannedMin,
}: {
  sessionId: string | null;
  startedAt: string | null;
  plannedMin: number | null;
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Focus");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const elapsed = startedAt ? Math.floor((now - new Date(startedAt).getTime()) / 1000) : 0;

  const start = async (planned: number | null) => {
    setBusy(true);
    setError("");
    const result = await startFocusAction({ plannedMin: planned });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  };

  const stop = async () => {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    const result = await stopFocusAction({ sessionId });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2" data-slot="focus-timer">
      <p className="font-mono text-3xl tabular-nums" aria-live="off">
        {format(elapsed)}
        {plannedMin ? (
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            {t("of", { value: plannedMin })}
          </span>
        ) : null}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {sessionId ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void stop()}>
            {t("stop")}
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" disabled={busy} onClick={() => void start(25)}>
              {t("start25")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void start(50)}
            >
              {t("start50")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void start(null)}
            >
              {t("startOpen")}
            </Button>
          </>
        )}
        <span
          className="font-mono text-[10px] text-muted-foreground"
          data-slot="focus-status"
          role="status"
        >
          {sessionId ? t("sessionRunning") : t("noSession")}
        </span>
        {error ? (
          <span role="alert" className="text-destructive">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
