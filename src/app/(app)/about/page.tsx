import { getLocale, getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import type { Locale } from "@/config/i18n";

import { LocaleSwitch } from "./_components/locale-switch";

export const metadata = { title: "About" };

const FEATURES = ["boards", "career", "life", "global"] as const;

/**
 * `/about` (spec §6.9, MVP #30, ADR-053): the working example page for the i18n scaffold. Every
 * string comes from the message catalog, and the language switch writes the locale cookie and
 * refreshes — enough to prove the pipeline before the rest of the shell is translated.
 */
export default async function AboutPage() {
  const t = await getTranslations("About");
  const locale = (await getLocale()) as Locale;

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h1>

      <div className="grid max-w-3xl gap-4">
        <Panel title={t("panelTitle")}>
          <p className="font-mono text-xs text-muted-foreground">{t("intro")}</p>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {FEATURES.map((feature) => (
              <li key={feature} data-slot="about-feature">
                {t(`features.${feature}`)}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t("language")}>
          <p className="font-mono text-xs text-muted-foreground">{t("languageHint")}</p>
          <LocaleSwitch locale={locale} />
        </Panel>
      </div>
    </>
  );
}
