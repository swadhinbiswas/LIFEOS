import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/config/i18n";

/**
 * Request-scoped i18n config (ADR-053). Without locale-based routing the locale comes from a
 * cookie, validated against the supported list so a forged value cannot load an arbitrary file.
 * Catalogs are imported explicitly so the bundler sees every file statically.
 */
const CATALOGS = {
  en: () => import("../../messages/en.json"),
  bn: () => import("../../messages/bn.json"),
} as const;

export default getRequestConfig(async () => {
  const store = await cookies();
  const requested = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await CATALOGS[locale]()).default,
  };
});
