import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { DOCS, docExists } from "@/server/docs";

export const metadata = { title: "Docs" };

/**
 * `/docs` (spec §13, ADR-087): an index of the repository documents with a live written/not-yet
 * state, plus the generated OpenAPI reference.
 */
export default async function DocsPage() {
  const t = await getTranslations("Pages.Docs");
  const entries = await Promise.all(
    DOCS.map(async (doc) => ({ doc, exists: await docExists(doc) })),
  );

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid max-w-3xl gap-4">
        <Panel title={t("title")}>
          <p className="font-mono text-[10px] text-muted-foreground">{t("intro")}</p>
          <ul className="mt-2 flex flex-col gap-1 font-mono text-xs" data-slot="docs-list">
            {entries.map(({ doc, exists }) => (
              <li key={doc.slug} className="flex flex-wrap items-center gap-2">
                {exists ? (
                  <Link href={`/docs/${doc.slug}`} className="text-primary hover:underline">
                    {doc.title}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{doc.title}</span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {exists ? doc.path : t("missing", { phase: doc.phase })}
                </span>
              </li>
            ))}
            <li>
              <Link href="/docs/api" className="text-primary hover:underline">
                {t("api")}
              </Link>
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
