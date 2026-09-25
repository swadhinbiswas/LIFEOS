import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionCookie } from "better-auth/cookies";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Check,
  Database,
  KeyRound,
  Keyboard,
  ListTodo,
  NotebookPen,
  Repeat,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

export const metadata = { title: { absolute: APP_NAME } };

/**
 * Public landing page (spec §14 Phase 8, ADR-086). A signed-in visitor is sent straight to the app;
 * everyone else gets the pitch: a TUI terminal you can read, the modules, the open-data story (the
 * same services behind the web app, REST and MCP), the keyboard model and three steps to start.
 * Everything is server-rendered and token-themed, so it passes axe in every preset.
 */

const HERO_LINES = [
  "$ lifeos add 'call the recruiter tomorrow 3pm #career'",
  "  ✓ captured → career · Thu 15:00",
  "$ lifeos today",
  "  ▸ 3 due today · 1 overdue · focus 25:00",
  "$ lifeos jobs move acme interview",
  "  ✓ moved Acme → Interview",
];

const API_SNIPPET = [
  "curl /api/v1/cards?limit=20 \\",
  "  -H 'Authorization: Bearer lifeos_live_…'",
];

const MODULES: Array<{ icon: LucideIcon; titleKey: string; bodyKey: string }> = [
  { icon: ListTodo, titleKey: "moduleTasksTitle", bodyKey: "moduleTasksBody" },
  { icon: Briefcase, titleKey: "moduleCareerTitle", bodyKey: "moduleCareerBody" },
  { icon: Repeat, titleKey: "moduleHabitsTitle", bodyKey: "moduleHabitsBody" },
  { icon: NotebookPen, titleKey: "moduleNotesTitle", bodyKey: "moduleNotesBody" },
  { icon: Wallet, titleKey: "moduleFinanceTitle", bodyKey: "moduleFinanceBody" },
  { icon: CalendarDays, titleKey: "moduleCalendarTitle", bodyKey: "moduleCalendarBody" },
];

const KEYCAPS: Array<{ keys: string[]; labelKey: string }> = [
  { keys: ["Ctrl", "K"], labelKey: "keyboardPalette" },
  { keys: ["g", "t"], labelKey: "keyboardGo" },
  { keys: ["n"], labelKey: "keyboardNew" },
  { keys: ["/"], labelKey: "keyboardSearch" },
];

const STEPS: Array<{ titleKey: string; bodyKey: string }> = [
  { titleKey: "step1Title", bodyKey: "step1Body" },
  { titleKey: "step2Title", bodyKey: "step2Body" },
  { titleKey: "step3Title", bodyKey: "step3Body" },
];

/** A TUI terminal with window chrome; the lines are illustrative and hidden from assistive tech. */
function TerminalWindow() {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span aria-hidden="true" className="size-2 rounded-full bg-destructive" />
        <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
        <span aria-hidden="true" className="size-2 rounded-full bg-success" />
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
          lifeos — zsh · {APP_NAME}
        </span>
      </div>
      <pre
        aria-hidden="true"
        className="flex flex-col gap-1.5 overflow-x-auto p-4 font-mono text-[11px] leading-relaxed"
      >
        {HERO_LINES.map((line, index) => (
          <span
            key={line}
            className={cn(
              "term-line",
              line.startsWith("$") ? "text-foreground" : "text-muted-foreground",
            )}
            style={{ animationDelay: `${index * 260}ms` }}
          >
            {line}
          </span>
        ))}
        <span
          className="term-line text-primary"
          style={{ animationDelay: `${HERO_LINES.length * 260}ms` }}
        >
          █
        </span>
      </pre>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  level = "h3",
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  level?: "h2" | "h3";
}) {
  const Heading = level;
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
      <span className="flex size-8 items-center justify-center rounded-[var(--radius)] border border-border text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <Heading className="font-mono text-sm font-semibold">{title}</Heading>
      <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function PointList({ points }: { points: string[] }) {
  return (
    <ul className="flex flex-col gap-2 font-mono text-[11px] text-muted-foreground">
      {points.map((point) => (
        <li key={point} className="flex items-start gap-2">
          <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function RootPage() {
  const signedIn = Boolean(getSessionCookie(await headers()));
  if (signedIn) redirect("/dashboard");

  const t = await getTranslations("Pages.Landing");

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-mono text-sm font-semibold">
            <Terminal aria-hidden="true" className="size-4 text-primary" />
            {APP_NAME}
          </Link>
          <nav
            aria-label={t("navLabel")}
            className="hidden items-center gap-5 font-mono text-xs text-muted-foreground md:flex"
          >
            <a href="#modules" className="hover:text-foreground">
              {t("navFeatures")}
            </a>
            <a href="#data" className="hover:text-foreground">
              {t("navData")}
            </a>
            <a href="#start" className="hover:text-foreground">
              {t("navStart")}
            </a>
            <Link href="/docs" className="hover:text-foreground">
              {t("navDocs")}
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/sign-in"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "font-mono")}
            >
              {t("signIn")}
            </Link>
            <Link href="/sign-up" className={cn(buttonVariants({ size: "sm" }), "font-mono")}>
              <span className="hidden sm:inline">{t("getStarted")}</span>
              <span className="sm:hidden">{t("getStartedShort")}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6">
        <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="flex flex-col gap-5">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              {t("eyebrow")}
            </span>
            <h1 className="font-mono text-3xl leading-tight font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="max-w-prose font-mono text-sm leading-relaxed text-muted-foreground">
              {t("heroBody")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }), "font-mono")}>
                {t("getStarted")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/docs"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "font-mono")}
              >
                {t("readDocs")}
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
              {[t("pointPwa"), t("pointData"), t("pointKeys")].map((point) => (
                <li key={point} className="flex items-center gap-1.5">
                  <Check aria-hidden="true" className="size-3.5 text-primary" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <TerminalWindow />
        </section>

        <section id="modules" className="scroll-mt-20 border-t border-border py-12">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="font-mono text-xl font-semibold tracking-tight">{t("modulesTitle")}</h2>
            <p className="font-mono text-xs leading-relaxed text-muted-foreground">
              {t("modulesBody")}
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((module) => (
              <FeatureCard
                key={module.titleKey}
                icon={module.icon}
                title={t(module.titleKey)}
                body={t(module.bodyKey)}
              />
            ))}
          </div>
        </section>

        <section id="data" className="scroll-mt-20 border-t border-border py-12">
          <div className="grid items-start gap-3 lg:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
              <span className="flex size-8 items-center justify-center rounded-[var(--radius)] border border-border text-primary">
                <Sparkles aria-hidden="true" className="size-4" />
              </span>
              <h2 className="font-mono text-sm font-semibold">{t("aiTitle")}</h2>
              <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                {t("aiBody")}
              </p>
              <PointList points={[t("aiPointApproval"), t("aiPointScoped"), t("aiPointAudit")]} />
            </div>
            <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
              <span className="flex size-8 items-center justify-center rounded-[var(--radius)] border border-border text-primary">
                <Database aria-hidden="true" className="size-4" />
              </span>
              <h2 className="font-mono text-sm font-semibold">{t("dataTitle")}</h2>
              <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                {t("dataBody")}
              </p>
              <PointList points={[t("dataPointRest"), t("dataPointMcp"), t("dataPointLlms")]} />
              <pre className="overflow-x-auto rounded-[var(--radius)] border border-border bg-background p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {API_SNIPPET.join("\n")}
              </pre>
            </div>
          </div>
        </section>

        <section className="border-t border-border py-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="flex flex-col gap-3">
              <span className="flex size-8 items-center justify-center rounded-[var(--radius)] border border-border text-primary">
                <Keyboard aria-hidden="true" className="size-4" />
              </span>
              <h2 className="font-mono text-xl font-semibold tracking-tight">
                {t("keyboardTitle")}
              </h2>
              <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                {t("keyboardBody")}
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {KEYCAPS.map((cap) => (
                <li
                  key={cap.labelKey}
                  className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card px-3 py-2 font-mono text-xs"
                >
                  <span className="flex items-center gap-1">
                    {cap.keys.map((key) => (
                      <kbd
                        key={key}
                        className="rounded-[var(--radius)] border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {key}
                      </kbd>
                    ))}
                  </span>
                  <span className="text-muted-foreground">{t(cap.labelKey)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="start" className="scroll-mt-20 border-t border-border py-12">
          <h2 className="font-mono text-xl font-semibold tracking-tight">{t("stepsTitle")}</h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.titleKey}
                className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4"
              >
                <span className="font-mono text-[10px] tracking-wider text-primary uppercase">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-mono text-sm font-semibold">{t(step.titleKey)}</h3>
                <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {t(step.bodyKey)}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-col items-start gap-4 rounded-[var(--radius)] border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
              <div className="flex flex-col">
                <h2 className="font-mono text-sm font-semibold">{t("ctaTitle")}</h2>
                <p className="font-mono text-[11px] text-muted-foreground">{t("ctaBody")}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }), "font-mono")}>
                {t("getStarted")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/docs"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "font-mono")}
              >
                {t("readDocs")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 font-mono text-sm font-semibold">
                <Terminal aria-hidden="true" className="size-4 text-primary" />
                {APP_NAME}
              </span>
              <p className="max-w-xs font-mono text-[11px] text-muted-foreground">
                {t("footerNote")}
              </p>
            </div>
            <nav aria-label={t("footerProduct")} className="flex flex-col gap-2 font-mono text-xs">
              <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
                {t("footerProduct")}
              </span>
              <Link href="/docs" className="text-muted-foreground hover:text-foreground">
                {t("footerDocs")}
              </Link>
              <Link href="/docs/api" className="text-muted-foreground hover:text-foreground">
                {t("footerApi")}
              </Link>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
                {t("footerPricing")}
              </Link>
            </nav>
            <nav aria-label={t("footerBuild")} className="flex flex-col gap-2 font-mono text-xs">
              <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
                {t("footerBuild")}
              </span>
              <Link
                href="/docs/self-hosting"
                className="text-muted-foreground hover:text-foreground"
              >
                {t("footerSelfHosting")}
              </Link>
              <Link href="/docs/security" className="text-muted-foreground hover:text-foreground">
                {t("footerSecurity")}
              </Link>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <KeyRound aria-hidden="true" className="size-3.5" />
                /llms.txt
              </span>
            </nav>
            <nav aria-label={t("footerAbout")} className="flex flex-col gap-2 font-mono text-xs">
              <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
                {t("footerAbout")}
              </span>
              <Link href="/about" className="text-muted-foreground hover:text-foreground">
                {t("footerAbout")}
              </Link>
              <Link href="/templates" className="text-muted-foreground hover:text-foreground">
                {t("navStart")}
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
