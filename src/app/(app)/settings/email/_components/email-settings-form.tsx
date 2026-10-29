"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { controlField } from "@/components/tui/controls";
import {
  connectEmailAction,
  disconnectEmailAction,
  refreshEmailAction,
  generateEmailSummaryAction,
} from "@/server/email/actions";

const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

export function EmailSettingsForm({
  account,
  encryptionOn,
}: {
  account: { host: string; port: number; username: string; mailbox: string } | null;
  encryptionOn: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("Pages.EmailSettings");
  const [host, setHost] = useState(account?.host ?? "imap.gmail.com");
  const [port, setPort] = useState(String(account?.port ?? 993));
  const [username, setUsername] = useState(account?.username ?? "");
  const [password, setPassword] = useState("");
  const [mailbox, setMailbox] = useState(account?.mailbox ?? "INBOX");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const run = async (call: () => Promise<{ ok: boolean; message?: string }>, done: string) => {
    setBusy(true);
    setError("");
    setStatus("");
    const result = await call();
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "something went wrong");
      return;
    }
    setStatus(done);
    router.refresh();
  };

  if (account && !password) {
    // Connected state: show account + actions.
    return (
      <div className="flex flex-col gap-3 text-xs">
        <p className="font-mono text-xs">
          {t("connected")}: <span className="text-foreground">{account.username}</span> @{" "}
          {account.host}:{account.port} ({account.mailbox})
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run(() => refreshEmailAction(), t("refresh"))}
          >
            {busy ? "…" : t("refresh")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run(() => generateEmailSummaryAction(), t("summarize"))}
          >
            {busy ? "…" : t("summarize")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void run(() => disconnectEmailAction(), t("disconnect"))}
          >
            {t("disconnect")}
          </Button>
        </div>
        {status ? (
          <span role="status" className="font-mono text-[10px] text-success">
            {status}
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="font-mono text-[10px] text-destructive">
            {error}
          </span>
        ) : null}
        <p className="font-mono text-[10px] text-muted-foreground">{t("hint")}</p>
      </div>
    );
  }

  return (
    <form
      method="post"
      className="flex flex-col gap-3 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (!encryptionOn) return;
        void run(
          () =>
            connectEmailAction({
              host: host.trim(),
              port: Number.parseInt(port, 10) || 993,
              username: username.trim(),
              password,
              mailbox: mailbox.trim() || "INBOX",
            }),
          t("connected"),
        ).then(() => setPassword(""));
      }}
    >
      <p className="font-mono text-[10px] text-muted-foreground">{t("hint")}</p>
      {!encryptionOn ? (
        <p className="font-mono text-[10px] text-destructive">{t("encryptionOff")}</p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className={`${label} min-w-48 flex-1`}>
          {t("host")}
          <input value={host} onChange={(e) => setHost(e.target.value)} className={controlField} />
        </label>
        <label className={label}>
          {t("port")}
          <input
            inputMode="numeric"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className={`${controlField} w-20`}
          />
        </label>
      </div>
      <label className={`${label} min-w-48`}>
        {t("username")}
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={controlField}
        />
      </label>
      <label className={`${label} min-w-48`}>
        {t("password")}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={controlField}
          autoComplete="off"
        />
      </label>
      <label className={`${label} min-w-48`}>
        {t("mailbox")}
        <input
          value={mailbox}
          onChange={(e) => setMailbox(e.target.value)}
          className={controlField}
        />
      </label>
      <Button
        type="submit"
        size="sm"
        disabled={busy || !encryptionOn || username.trim() === "" || password === ""}
      >
        {busy ? "…" : t("testAndSave")}
      </Button>
      {status ? (
        <span role="status" className="font-mono text-[10px] text-success">
          {status}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="font-mono text-[10px] text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
