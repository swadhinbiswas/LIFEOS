"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";

import { THEME_COOKIE } from "@/config/app";
import { themeOverridesSchema } from "@/config/themes";
import { isValidTimeZone } from "@/lib/timezone";
import { auth } from "@/server/auth";
import { saveThemeOverrides, setTimeZone, setWeekStart } from "@/server/settings";

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

const timeZoneInput = z.object({ timeZone: z.string().trim().min(1).max(64) });

/** Persist the user's timezone (ADR-057); the value must be a real IANA zone. */
export async function setTimeZoneAction(
  input: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = timeZoneInput.safeParse(input);
  if (!parsed.success || !isValidTimeZone(parsed.data.timeZone)) {
    return { ok: false, message: "unknown timezone" };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  await setTimeZone(session.user.id, parsed.data.timeZone);
  return { ok: true };
}

const weekStartInput = z.object({ weekStart: z.enum(["mon", "sun"]) });

/** Persist the user's week start (ADR-058); it anchors every "this week" number. */
export async function setWeekStartAction(
  input: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = weekStartInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "unknown week start" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  await setWeekStart(session.user.id, parsed.data.weekStart);
  return { ok: true };
}
