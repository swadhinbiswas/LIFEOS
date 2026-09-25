"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "cn";

/**
 * Second-level settings navigation (reference anatomy): the settings pages are sections of one
 * place, so they get their own list rather than being scattered across the main sidebar. Active
 * state is `aria-current`, not colour alone.
 */
export function SettingsNav({ items }: { items: Array<{ href: string; key: string }> }) {
  const pathname = usePathname();
  const tNav = useTranslations("Nav");

  return (
    <nav
      aria-label={tNav("profile")}
      data-slot="settings-nav"
      className="flex flex-col gap-0.5 lg:sticky lg:top-4 lg:self-start"
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-[var(--radius)] px-2 py-1.5 font-mono text-xs transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            {tNav(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
