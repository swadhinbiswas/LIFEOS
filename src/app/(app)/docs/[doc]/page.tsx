import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { docBySlug, DOCS, readDoc } from "@/server/docs";

export const metadata = { title: "Docs" };

/**
 * One repository document (spec §13, ADR-087). Content is trusted repo text and is rendered as
 * preformatted text — never as HTML — so a Markdown file can never inject markup into the app.
 */
export default async function DocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc: slug } = await params;
  const entry = docBySlug(slug);
  if (!entry) notFound();

  const t = await getTranslations("Pages.Docs");
  const content = await readDoc(entry);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {entry.title}
      </h1>

      <div className="grid max-w-4xl gap-4">
        <Panel title={entry.path} hint={content ? undefined : entry.phase}>
          {content ? (
            <pre
              data-slot="doc-content"
              className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed"
            >
              {content}
            </pre>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">
              {t("missing", { phase: entry.phase })}
            </p>
          )}
          <nav className="mt-3 flex flex-wrap gap-3">
            <Link href="/docs" className="font-mono text-xs text-muted-foreground hover:underline">
              {t("backToDocs")}
            </Link>
            {DOCS.filter((candidate) => candidate.slug !== entry.slug)
              .slice(0, 4)
              .map((candidate) => (
                <Link
                  key={candidate.slug}
                  href={`/docs/${candidate.slug}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {candidate.title}
                </Link>
              ))}
          </nav>
        </Panel>
      </div>
    </>
  );
}
