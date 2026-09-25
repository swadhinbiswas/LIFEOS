import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionCookie } from "better-auth/cookies";

import { Panel } from "@/components/tui/panel";
import { APP_NAME } from "@/config/app";

export const metadata = { title: APP_NAME };

/**
 * Public landing page (spec §14 Phase 8, ADR-086). A signed-in visitor is sent straight to the app;
 * everyone else sees the TUI hero (typed with CSS, no client JavaScript) and the two entry points:
 * the no-account demo and sign-in.
 */
const HERO_LINES = [
  "$ lifeos add 'call the recruiter tomorrow 3pm #career'",
  "  ✓ captured → career / To call",
  "$ lifeos today",
  "  ▸ 3 due today · 1 overdue · focus 25:00",
  "$ lifeos jobs move acme interview",
  "  ✓ moved Acme → Interview",
];

export default async function RootPage() {
  const signedIn = Boolean(getSessionCookie(await headers()));
  if (signedIn) redirect("/dashboard");

  const t = await getTranslations("Pages.Landing");
  const features = [t("featureTasks"), t("featureCareer"), t("featureLife"), t("featureAi")];

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs font-semibold tracking-wider uppercase">{APP_NAME}</p>
        <h1 className="font-mono text-xl font-semibold tracking-tight">{t("heroTitle")}</h1>
        <p className="font-mono text-xs text-muted-foreground">{t("tagline")}</p>
      </header>

      <Panel title="tty1" hint="lifeos">
        <pre className="flex flex-col gap-1 overflow-x-auto font-mono text-[11px] leading-relaxed">
          {HERO_LINES.map((line, index) => (
            <span key={line} className="term-line" style={{ animationDelay: `${index * 350}ms` }}>
              {line}
            </span>
          ))}
        </pre>
      </Panel>

      <p className="max-w-prose font-mono text-xs text-muted-foreground">{t("heroBody")}</p>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/demo"
          className="rounded-[var(--radius)] border border-primary bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground hover:opacity-90"
        >
          {t("tryDemo")}
        </Link>
        <Link
          href="/sign-in"
          className="rounded-[var(--radius)] border border-border bg-background px-3 py-1.5 font-mono text-xs hover:bg-accent hover:text-accent-foreground"
        >
          {t("signIn")}
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          {t("featuresTitle")}
        </p>
        <ul className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
          {features.map((feature) => (
            <li key={feature}>▸ {feature}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
