import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { BOARD_TEMPLATES } from "@/config/board-templates";

import { pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata() {
  return pageMetadata("Pages.Templates", "title");
}

/**
 * Public template gallery (spec §14 Phase 8, MVP #50/#54, ADR-085): the board templates and the
 * starter profiles a new account can pick from. Create an account to use them.
 */
export default async function TemplatesPage() {
  const t = await getTranslations("Pages.Templates");

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h1>

      <div className="grid gap-4">
        <p className="font-mono text-[10px] text-muted-foreground">{t("intro")}</p>
        <Link
          href="/sign-up"
          className="w-fit rounded-[var(--radius)] border border-primary bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground hover:opacity-90"
        >
          {t("createAccount")}
        </Link>

        <Panel title={t("boardsTitle")} hint={`${BOARD_TEMPLATES.length}`}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {BOARD_TEMPLATES.map((template) => (
              <li key={template.id} className="border border-border p-2 font-mono text-xs">
                <span className="block">{template.name}</span>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {template.columns.map((column) => column.name).join(" · ")}
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {t("columns", { count: template.columns.length })}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </main>
  );
}
