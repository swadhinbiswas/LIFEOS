"use client";

import Link from "next/link";
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
 */
export function VerifyEmailNotice({ token }: { token: string | null }) {
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;

    let cancelled = false;
    authClient
      .verifyEmail({ query: { token } })
      .then(({ error }) => {
        if (cancelled) return;
        if (error) {
          setStatus("error");
          setMessage(authErrorMessage(error));
        } else {
          setStatus("ok");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(authErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Missing token is a pure render condition — no state, no synchronous setState
  // inside the effect (react-hooks/set-state-in-effect).
  if (!token) {
    return (
      <div className="flex flex-col gap-3 text-xs">
        <p role="alert" className="text-destructive">
          this link is missing its token — sign in to have a fresh one sent
        </p>
        <Button type="button" variant="outline" asChild>
          <Link href="/sign-in">back to sign in</Link>
        </Button>
      </div>
    );
  }

  if (status === "verifying") {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        verifying your email…
      </p>
    );
  }

  if (status === "ok") {
    return (
      <div role="status" className="flex flex-col gap-3 text-xs">
        <p className="text-success">✓ email verified — your account is ready</p>
        <Button type="button" className="w-full" asChild>
          <Link href="/sign-in">sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      <p role="alert" className="text-destructive">
        {message}
      </p>
      <p className="text-muted-foreground">
        signing in re-sends the verification mail when the account is still pending.
      </p>
      <Button type="button" variant="outline" asChild>
        <Link href="/sign-in">back to sign in</Link>
      </Button>
    </div>
  );
}
