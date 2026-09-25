import { PageHeader } from "@/components/tui/page-header";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getServerSession } from "@/server/auth/session";

import { ThemeCustomizer } from "../_components/theme-customizer";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Appearance", "title");
}

/**
 * Appearance (spec §4.2/§13): every customizer axis, live and persisted per user (ADR-024).
 * The session re-check here satisfies ADR-026 for this route.
 */
export default async function AppearancePage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Appearance");
  return (
    <>
      <PageHeader title={t("title")} />
      <ThemeCustomizer />
    </>
  );
}
