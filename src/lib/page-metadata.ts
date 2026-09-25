import { getTranslations } from "next-intl/server";

/**
 * Route metadata localized (ADR-072 follow-up).
 *
 * Every page carried `export const metadata = { title: "Dashboard" }` — a hardcoded English string
 * that next-intl cannot reach, so the browser tab, the history entry and any client-side navigation
 * title stayed English even on a fully Bangla page. `generateMetadata` reads the same catalogue the
 * body does, so a title can no longer drift from its page.
 *
 * A page opts in with `t("title")` under its own namespace. The `%s · LifeOS` template lives in the
 * root layout, so a page supplies only its own name.
 */
export async function pageMetadata(namespace: string, key = "title") {
  const t = await getTranslations(namespace);
  return { title: t(key) } as const;
}
