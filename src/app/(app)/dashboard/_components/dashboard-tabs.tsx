"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "cn";

/**
 * The dashboard variant switcher. This is **navigation** (the variant lives in the URL, ADR-042), so
 * it is a nav of links, not Radix tabs — tabs would need a content panel per value and axe rightly
 * flags a trigger whose `aria-controls` points at nothing.
 */
const KEYS: Record<string, string> = {
  today: "variantToday",
  overview: "variantOverview",
  career: "variantCareer",
  productivity: "variantProductivity",
};

export function DashboardTabs({
  variant,
  variants,
}: {
  variant: string;
  variants: readonly string[];
}) {
  const t = useTranslations("Pages.Dashboard");

  return (
    <nav
      aria-label={t("title")}
      data-slot="variant-switch"
      className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-border bg-background p-0.5 font-mono text-[10px]"
    >
      {variants.map((option) => (
        <Link
          key={option}
          href={`/dashboard?variant=${option}`}
          aria-current={option === variant ? "page" : undefined}
          className={cn(
            "rounded-[var(--radius)] px-2 py-0.5 transition-colors",
            option === variant
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {t(KEYS[option] ?? option)}
        </Link>
      ))}
    </nav>
  );
}
