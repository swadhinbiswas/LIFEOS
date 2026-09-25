"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteWakaTimeKeyAction,
  saveWakaTimeKeyAction,
  syncWakaTimeAction,
} from "@/server/activity/actions";

interface Connection {
  hint: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

/**
 * WakaTime connection (ADR-110). The key is pasted here, encrypted on arrival, and only its last
 * four characters are ever shown again. "sync" pulls the last 30 days; the dashboard then reads the
 * local cache, so no page render waits on the network.
 */
export function WakaTimeForm({
  connection,
  encryptionOn,
}: {
  connection: Connection | null;
  encryptionOn: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("Pages.Activity");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"save" | "sync" | "remove" | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (action: () => Promise<{ ok: boolean; message?: string; days?: number }>) => {
    setNotice(null);
    const result = await action();
    setNotice(
      result.ok
        ? {
            ok: true,
            text: result.days === undefined ? t("saved") : t("syncedDays", { days: result.days }),
          }
        : { ok: false, text: result.message ?? t("failed") },
    );
    return result;
  };

  const save = async () => {
    if (key.trim() === "") return;
    setBusy("save");
    const result = await run(() => saveWakaTimeKeyAction({ key: key.trim() }));
    setBusy(null);
    if (result.ok) {
      setKey("");
      router.refresh();
    }
  };

  const sync = async () => {
    setBusy("sync");
    await run(syncWakaTimeAction);
    setBusy(null);
    router.refresh();
  };

  const remove = async () => {
    setBusy("remove");
    await run(deleteWakaTimeKeyAction);
    setBusy(null);
    router.refresh();
  };

  if (!encryptionOn) {
    return (
      <p className="font-mono text-xs text-muted-foreground" role="status">
        {t("noEncryption")}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {connection ? (
        <dl className="grid gap-1 font-mono text-[11px] text-muted-foreground">
          <div className="flex gap-2">
            <dt>{t("keyLabel")}</dt>
            <dd className="text-foreground">••••{connection.hint}</dd>
          </div>
          <div className="flex gap-2">
            <dt>{t("lastSync")}</dt>
            <dd className="text-foreground">
              {connection.lastSyncedAt
                ? new Date(connection.lastSyncedAt).toLocaleString()
                : t("never")}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1">
          <span className="font-mono text-[10px] text-muted-foreground">{t("apiKey")}</span>
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="waka_…"
            className="w-64 font-mono"
            aria-describedby="wakatime-key-hint"
          />
        </label>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={busy !== null || key.trim() === ""}
        >
          {busy === "save" ? t("saving") : t("save")}
        </Button>
        {connection ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={sync}
              disabled={busy !== null}
            >
              {busy === "sync" ? t("syncing") : t("syncNow")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={remove}
              disabled={busy !== null}
            >
              {t("disconnect")}
            </Button>
          </>
        ) : null}
      </div>

      <p id="wakatime-key-hint" className="font-mono text-[10px] text-muted-foreground">
        {t("keyHint")}
      </p>

      {connection?.lastError ? (
        <p role="alert" className="font-mono text-[11px] text-destructive">
          {t("lastError", { error: connection.lastError })}
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className={
            notice.ok
              ? "font-mono text-[11px] text-muted-foreground"
              : "font-mono text-[11px] text-destructive"
          }
        >
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
