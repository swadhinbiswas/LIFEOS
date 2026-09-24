"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, safeNext } from "@/lib/auth-form";

export type SocialProvider = "github" | "google";

/**
 * OAuth buttons, rendered only for providers whose env pair is complete (ADR-023 — the
 * server page passes exactly the providers `socialProviders` actually configured, so the
 * UI can never offer a button that would fail at `/sign-in/social`).
 */
export function SocialButtons({
  providers,
  next,
}: {
  providers: SocialProvider[];
  next?: string | null;
}) {
  const t = useTranslations("Auth");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<SocialProvider | null>(null);

  if (providers.length === 0) return null;

  const label = (provider: SocialProvider) =>
    provider === "github" ? t("continueWithGithub") : t("continueWithGoogle");

  const start = async (provider: SocialProvider): Promise<void> => {
    setError(null);
    setPending(provider);
    try {
      const { data, error: failure } = await authClient.signIn.social({
        provider,
        callbackURL: safeNext(next),
      });
      if (failure) {
        setError(authErrorMessage(failure));
        setPending(null);
        return;
      }
      // The default redirect plugin normally navigates on its own; this is the fallback.
      const url = data && typeof data === "object" && "url" in data ? data.url : undefined;
      if (typeof url === "string" && url.length > 0) window.location.assign(url);
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            disabled={pending !== null}
            onClick={() => void start(provider)}
          >
            {label(provider)}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
