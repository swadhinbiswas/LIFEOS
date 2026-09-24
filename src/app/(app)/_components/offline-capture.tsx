"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { flushCaptureQueue, getPendingCount, subscribe } from "@/lib/capture-queue";
import { captureTaskAction } from "@/server/capture/actions";

/**
 * Offline capture status (MVP #29, ADR-051). Mounted in the shell, it replays queued captures
 * when the connection returns and shows how many are waiting. The queue itself is external
 * state, read through `useSyncExternalStore`, so there is no effect that writes React state.
 */

const subscribeOnline = (listener: () => void): (() => void) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};

const getOnline = (): boolean => navigator.onLine;
/** Server render assumes online, so the status node is absent from the first paint. */
const getOnlineServer = (): boolean => true;

export function OfflineCapture() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const online = useSyncExternalStore(subscribeOnline, getOnline, getOnlineServer);
  const pending = useSyncExternalStore(subscribe, getPendingCount, () => 0);

  const flush = useCallback(async () => {
    const sent = await flushCaptureQueue(async (item) => {
      try {
        const result = await captureTaskAction({ text: item.text, columnName: item.columnName });
        return result.ok;
      } catch {
        return false; // still no network — keep it queued
      }
    });
    if (sent > 0) {
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      router.refresh();
    }
  }, [queryClient, router]);

  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);

  if (online && pending === 0) return null;

  return (
    <div
      data-slot="offline-queue-status"
      role="status"
      className="flex items-center gap-2 font-mono text-[10px] text-warning"
    >
      <span>{online ? "queued" : "offline"}</span>
      <span data-slot="offline-queue-count" className="tabular-nums">
        {pending} waiting
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!online || pending === 0}
        onClick={() => void flush()}
      >
        sync now
      </Button>
    </div>
  );
}
