import type { Metadata, Viewport } from "next";
import { Fira_Code, IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { cookies } from "next/headers";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { APP_DESCRIPTION, APP_NAME, THEME_COOKIE } from "@/config/app";
import { accentCssVars, parseThemeOverrides, themeAttrs } from "@/config/themes";

import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});
// GeistMono ships pre-configured (variable "--font-geist-mono") — a value, not a factory.
const firaCode = Fira_Code({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fira",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
});
// Inter (prose) is intentionally absent: no prose area ships until the notes editor
// (Phase 3) — spec §1 hides out-of-phase features entirely instead of loading them.

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
};

/** Browser chrome colour; the PWA manifest carries the same value (ADR-055). */
export const viewport: Viewport = { themeColor: "#1a1b26" };

/**
 * Resolves `colorMode: "system"` against the OS preference before first paint, so SSR
 * (which cannot know the OS setting) never flashes the wrong palette (ADR-024).
 * Sets both the resolved palette (data-theme) and the resolved mode (data-mode, which
 * powers the Tailwind dark: variant — ADR-034). Static string, no user input.
 */
const SYSTEM_MODE_SCRIPT = `(function(){try{var h=document.documentElement;if(h.getAttribute("data-color-mode")!=="system")return;var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var p=h.getAttribute("data-preset");h.setAttribute("data-mode",d?"dark":"light");h.setAttribute("data-theme",d?(p==="paper"?"midnight":p):"paper");}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const overrides = parseThemeOverrides(cookieStore.get(THEME_COOKIE)?.value);
  // SSR cannot know the OS preference → assume dark; SYSTEM_MODE_SCRIPT corrects before paint.
  const attrs = themeAttrs(overrides, true);
  // Locale is a cookie (ADR-053), so it is available before any session is resolved.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        jetbrains.variable,
        GeistMono.variable,
        firaCode.variable,
        plexMono.variable,
        "font-sans",
      )}
      {...attrs}
      style={accentCssVars(overrides, true) as React.CSSProperties}
    >
      <head>
        {/* Runs before paint by design (ADR-024, no FOUC) — a static string with no
            user input, not an inline event handler. `next/script` with `beforeInteractive`
            injects it into the initial HTML instead of React mounting a <script> node
            on the client, which would never execute and warns at hydration. */}
        <Script
          id="system-color-mode"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: SYSTEM_MODE_SCRIPT }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        <ServiceWorkerRegistrar />
        <Toaster />
      </body>
    </html>
  );
}
