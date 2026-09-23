import type { ReactNode } from "react";

import { APP_NAME, APP_TAGLINE } from "@/config/app";

/**
 * Shared shell for the (auth) route group (spec §5): identity header + centred card column.
 * `<main>` is the landmark the route-level axe pass expects; the (app) shell is separate.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4">
      <header className="text-center">
        <p className="font-mono text-lg font-semibold tracking-tight">{APP_NAME}</p>
        <p className="font-mono text-xs text-muted-foreground">{APP_TAGLINE}</p>
      </header>
      <main className="w-full max-w-sm">{children}</main>
    </div>
  );
}
