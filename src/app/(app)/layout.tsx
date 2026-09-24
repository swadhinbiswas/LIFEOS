import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { THEME_COOKIE } from "@/config/app";
import { parseThemeOverrides } from "@/config/themes";
import { auth } from "@/server/auth";
import { getRunningSession } from "@/server/focus";
import { unreadCount } from "@/server/notifications";
import { getThemeOverrides, getTimeZone } from "@/server/settings";

import { AppShell } from "./_components/app-shell";
import { ThemeSync } from "./_components/theme-sync";
import { AppProviders } from "./_providers/app-providers";

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
  // The focus session is a database row (ADR: /focus), so the shell can show it on any page.
  const focus = await getRunningSession(session.user.id);
  // The bell sweeps the notification sources on read (ADR-047), bucketed by the user's day
  // (ADR-057), so its number is always current.
  const timeZone = await getTimeZone(session.user.id);
  const unread = await unreadCount(session.user.id, new Date(), timeZone);

  return (
    <AppProviders>
      <ThemeSync initial={initial} fromDb={fromDb} />
      <AppShell
        user={{ name: session.user.name }}
        focus={focus ? { id: focus.id, startedAt: new Date(focus.started_at).toISOString() } : null}
        unread={unread}
      >
        {children}
      </AppShell>
    </AppProviders>
  );
}
