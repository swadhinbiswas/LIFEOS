/**
 * Locale contract (spec §6.9, ADR-053). The locale is a cookie, not a route segment: it must be
 * readable during SSR before the session resolves, and the auth pages need it too.
 */

export const LOCALES = ["en", "bn"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Endonyms, so a speaker finds their language without knowing English. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  bn: "বাংলা",
};

export const isLocale = (value: string | undefined): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);
