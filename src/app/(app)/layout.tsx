import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { THEME_COOKIE } from "@/config/app";
import { parseThemeOverrides } from "@/config/themes";
import { auth } from "@/server/auth";
import { getThemeOverrides } from "@/server/settings";

import { AppShell } from "./_components/app-shell";
import { ThemeSync } from "./_components/theme-sync";

/**
 * Signed-in shell. The real session check lives here — proxy.ts (ADR-026) only redirects on
 * cookie presence. The cookie seeds first paint (root layout); when the user has saved
 * overrides in `user_settings`, those win on hydration and follow them across devices.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const cookieStore = await cookies();
  const initial = parseThemeOverrides(cookieStore.get(THEME_COOKIE)?.value);
  const fromDb = await getThemeOverrides(session.user.id);

  return (
    <>
      <ThemeSync initial={initial} fromDb={fromDb} />
      <AppShell user={{ name: session.user.name }}>{children}</AppShell>
    </>
  );
}
