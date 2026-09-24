"use server";

import { cookies, headers } from "next/headers";

import { THEME_COOKIE } from "@/config/app";
import { themeOverridesSchema } from "@/config/themes";
import { auth } from "@/server/auth";
import { saveThemeOverrides } from "@/server/settings";

/**
 * Thin Server-Action adapter over the settings service (spec §7.2): REST/MCP/AI adapters call
 * the same service functions. Lives under `server/` because it is part of the service layer,
 * not the route tree — `"use server"` makes it a client-callable RPC reference.
 *
 * The cookie is the first-paint source (ADR-024); it is written for signed-out visitors too,
 * so a theme chosen before signing in survives the reload and then the sign-in.
 */

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function persistTheme(input: unknown): Promise<{ ok: boolean }> {
  const parsed = themeOverridesSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, JSON.stringify(parsed.data), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
  });

  const session = await auth.api.getSession({ headers: await headers() });
  if (session) await saveThemeOverrides(session.user.id, parsed.data);

  return { ok: true };
}
