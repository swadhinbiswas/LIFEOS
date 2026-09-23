import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Root route: redirect by session-cookie presence only (UX, not security — ADR-026).
 * The (app) layout performs the real session check. Marketing landing ships in Phase 8,
 * so signed-out visitors go to /sign-in (ADR-025: no out-of-phase pages).
 */
export default async function RootPage() {
  const signedIn = Boolean(getSessionCookie(await headers()));
  redirect(signedIn ? "/settings" : "/sign-in");
}
