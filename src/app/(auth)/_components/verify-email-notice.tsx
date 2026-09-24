"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-form";

type Status = "verifying" | "ok" | "error";

/**
 * Consumes the `?token=` from the mailed link exactly once — the ref guard keeps React
 * StrictMode's double effect from burning the single-use token (the second call would see
 * it already consumed and show a false failure). Client-side on mount, never during server
 * render, for the same reason.
 *
 * Do NOT also cancel the in-flight call from the effect cleanup: in dev StrictMode the
 * sequence is effect → cleanup → effect, the second effect bails on the ref guard, so a
 * cleanup-driven `cancelled` flag would suppress the only response and the page would stay
 * on "verifying" forever. The guard already bounds this to one request per mount.
 */
export function VerifyEmailNotice({ token }: { token: string | null }) {
  const t = useTranslations("Auth");
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;

    authClient
      .verifyEmail({ query: { token } })
      .then(({ error }) => {
        if (error) {
          setStatus("error");
          setMessage(authErrorMessage(error));
        } else {
          setStatus("ok");
        }
      })
      .catch((err: unknown) => {
        setStatus("error");
        setMessage(authErrorMessage(err));
      });
  }, [token]);

  // Missing token is a pure render condition — no state, no synchronous setState
  // inside the effect (react-hooks/set-state-in-effect).
  if (!token) {
    return (
      <div className="flex flex-col gap-3 text-xs">
        <p role="alert" className="text-destructive">
          {t("missingToken")}
        </p>
        <Button type="button" variant="outline" asChild>
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </Button>
      </div>
    );
  }

  if (status === "verifying") {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        {t("verifying")}
      </p>
    );
  }

  if (status === "ok") {
    return (
      <div role="status" className="flex flex-col gap-3 text-xs">
        <p className="text-success">{t("emailVerified")}</p>
        <Button type="button" className="w-full" asChild>
          <Link href="/sign-in">{t("signIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      <p role="alert" className="text-destructive">
        {message}
      </p>
      <p className="text-muted-foreground">{t("verifyFailedHint")}</p>
      <Button type="button" variant="outline" asChild>
        <Link href="/sign-in">{t("backToSignIn")}</Link>
      </Button>
    </div>
  );
}
