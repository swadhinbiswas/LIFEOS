"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { LOCALE_COOKIE, LOCALES } from "@/config/i18n";
import type { ActionResult } from "@/server/boards/actions";

/**
 * Locale adapter (spec §6.9, ADR-053). No session is required: the auth pages render before a
 * user exists and should still honour the cookie. The value is validated against the supported
 * list, so the request config can never import an arbitrary file.
 */

const localeInput = z.object({ locale: z.enum(LOCALES) });

export async function setLocaleAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = localeInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: "unsupported locale" };

  const store = await cookies();
  store.set(LOCALE_COOKIE, parsed.data.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return { ok: true, data: null };
}
