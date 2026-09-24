import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { APP_NAME } from "@/config/app";

/**
 * Shared shell for the (auth) route group (spec §5): identity header + centred card column.
 * `<main>` is the landmark the route-level axe pass expects; the (app) shell is separate. The
 * tagline is translated (ADR-060), so the locale cookie applies before a user even signs in.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Shell");
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4">
      <header className="text-center">
        <p className="font-mono text-lg font-semibold tracking-tight">{APP_NAME}</p>
        <p className="font-mono text-xs text-muted-foreground">{t("tagline")}</p>
      </header>
      <main className="w-full max-w-sm">{children}</main>
    </div>
  );
}
