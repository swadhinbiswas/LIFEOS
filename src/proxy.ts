import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * ADR-026: redirect-only gate. Cookie *presence* decides UX flow, never authorization —
 * the real check (`auth.api.getSession`) runs in the `(app)`/`(auth)` layouts, so a stale
 * or forged cookie can render a shell here but can never read data. Route surface is
 * Phase 1 only (ADR-025); later phases extend the two prefix lists.
 */
const PROTECTED = ["/settings"];
const AUTH_PAGES = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email"];

const matches = (pathname: string, prefixes: string[]): boolean =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export default function proxy(request: NextRequest): NextResponse {
  const signedIn = Boolean(getSessionCookie(request));
  const { pathname } = request.nextUrl;

  if (!signedIn && matches(pathname, PROTECTED)) {
    const next = encodeURIComponent(`${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(new URL(`/sign-in?next=${next}`, request.url));
  }

  if (signedIn && matches(pathname, AUTH_PAGES)) {
    return NextResponse.redirect(new URL("/settings", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/settings/:path*",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ],
};
