import { getTranslations } from "next-intl/server";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * An auth page is one centred form with no app chrome, so a full-width skeleton would misdescribe
 * the layout.
 *
 * The `h1` is not decoration. The real page's heading is its panel title rendered with
 * `titleAs="h1"` (ADR-041), and a loading state is a real page state for as long as it lasts — so
 * leaving the heading out would fail `page-has-heading-one` for anyone arriving through a
 * client-side transition. The public routes are only ever scanned as cold documents, which is
 * exactly why nothing had caught it.
 */
export default async function Loading() {
  const t = await getTranslations("Common");
  return (
    <div className="flex min-h-svh items-center justify-center p-4" data-slot="loading-sign-up">
      <div className="grid w-full max-w-sm gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
        <h1 className="font-mono text-xs font-medium tracking-wider uppercase">
          <span className="sr-only">{t("loadingLabel")}</span>
          <Skeleton className="h-3 w-28" aria-hidden="true" />
        </h1>
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col gap-1">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-full" />
        <Skeleton className="mx-auto h-2.5 w-40" />
      </div>
    </div>
  );
}
