"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { StatusLine } from "@/components/tui/status-line";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/app";
import { NAV_ITEMS } from "@/config/nav";
import { SHELL_HINTS } from "@/config/shortcuts";
import { stopFocusAction } from "@/server/focus/actions";
import { authClient } from "@/lib/auth-client";
import { useThemeStore } from "@/lib/theme-store";
import { cn } from "@/lib/utils";

import { CommandPalette } from "./command-palette";
import { CopilotOverlay } from "./copilot-overlay";
import { GlobalKeyboard } from "./global-keyboard";
import { HelpOverlay } from "./help-overlay";
import { OfflineCapture } from "./offline-capture";

/** Cycle order per ADR-028: `[` walks expanded → icon → full → expanded. */
const SIDEBAR_MODES: readonly string[] = ["expanded", "icon", "full"];

/**
 * The (app) shell: sidebar (geometry is pure CSS driven by the ADR-024/028 data attributes),
 * header, scrollable main column and the spec §4.1 status line. Client-side because it owns
 * the keyboard bindings, the sidebar overlay and sign-out.
 */
export function AppShell({
  user,
  focus,
  unread,
  billing,
  children,
}: {
  user: { name: string };
  /** A running focus session, so the timer is ambient across pages (spec §6.7). */
  focus: { id: string; startedAt: string } | null;
  /** Unread notifications for the header bell (spec §6.9). */
  unread: number;
  /** Whether the billing surface exists at all (ADR-082); hidden when false. */
  billing: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tNav = useTranslations("Nav");
  const tShell = useTranslations("Shell");
  const tShortcut = useTranslations("Shortcuts");
  const sidebarMode = useThemeStore((state) => state.overrides.sidebarMode);
  const setOverride = useThemeStore((state) => state.set);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotPrompt, setCopilotPrompt] = useState<string | undefined>(undefined);
  const [helpOpen, setHelpOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [stoppingFocus, setStoppingFocus] = useState(false);

  // The ambient timer ticks locally from the session row's start, so it survives navigation.
  useEffect(() => {
    if (!focus) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [focus]);

  const focusTimer = focus
    ? (() => {
        const seconds = Math.max(0, Math.floor((now - new Date(focus.startedAt).getTime()) / 1000));
        return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      })()
    : undefined;

  const stopFocus = async () => {
    if (!focus) return;
    setStoppingFocus(true);
    await stopFocusAction({ sessionId: focus.id });
    setStoppingFocus(false);
    router.refresh();
  };

  // Derived, not synced: entering `full` reveals the bar; Esc/`[` dismiss it (ADR-028).
  const overlayOpen = sidebarMode === "full" && !overlayDismissed;

  const cycleSidebar = useCallback(() => {
    const index = SIDEBAR_MODES.indexOf(sidebarMode);
    const next = SIDEBAR_MODES[(index + 1) % SIDEBAR_MODES.length] ?? "expanded";
    setOverlayDismissed(false);
    setOverride("sidebarMode", next);
  }, [setOverride, sidebarMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      // Modifier shortcuts stay global (spec §4.3): Ctrl/Cmd+K opens the palette even while
      // the user is typing in a field.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }

      // Ctrl/Cmd+J opens the copilot slide-over anywhere (spec §8), like the palette.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setCopilotOpen(true);
        return;
      }

      // Everything else is disabled inside a field so typing is never hijacked.
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "[") {
        event.preventDefault();
        cycleSidebar();
      } else if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      } else if (event.key === "Escape" && overlayOpen) {
        setOverlayDismissed(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycleSidebar, overlayOpen]);

  // Contextual buttons anywhere dispatch this event to open the copilot with a prompt (spec §8).
  useEffect(() => {
    const onAsk = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail;
      setCopilotPrompt(detail?.prompt);
      setCopilotOpen(true);
    };
    window.addEventListener("lifeos:copilot", onAsk);
    return () => window.removeEventListener("lifeos:copilot", onAsk);
  }, []);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    // ADR-055: never leave a previous user's cached shell on a shared browser.
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    router.push("/sign-in");
    router.refresh();
  }

  const sidebarButton = () => {
    if (sidebarMode === "full") {
      setOverlayDismissed((dismissed) => !dismissed);
      return;
    }
    cycleSidebar();
  };

  return (
    <div
      className="app-shell flex min-h-svh bg-background"
      data-overlay={overlayOpen ? "open" : "closed"}
    >
      <aside
        className="app-sidebar"
        style={{ width: "var(--sidebar-width)", margin: "var(--sidebar-gap)" }}
      >
        <div
          className="flex h-full flex-col border-border bg-card"
          style={{
            borderRadius: "var(--sidebar-radius)",
            boxShadow: "var(--sidebar-shadow)",
            borderWidth: "var(--sidebar-border-width)",
            borderStyle: "solid",
          }}
        >
          <p className="app-sidebar-brand px-3 py-3 font-mono text-sm font-semibold tracking-tight">
            {APP_NAME}
          </p>
          <nav aria-label={tShell("primaryNav")} className="flex flex-1 flex-col gap-1 p-2">
            {NAV_ITEMS.filter((item) => !item.requiresBilling || billing).map(
              ({ href, key, icon: Icon }) => {
                const label = tNav(key);
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    title={label}
                    className={cn(
                      "flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 font-mono text-xs",
                      "hover:bg-accent hover:text-accent-foreground",
                      active && "bg-accent text-accent-foreground",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="nav-label truncate">{label}</span>
                  </Link>
                );
              },
            )}
          </nav>
          <p className="nav-label truncate border-t border-border px-3 py-2 font-mono text-xs text-muted-foreground">
            {user.name}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-3 py-2">
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {tShell("tagline")}
          </p>
          {focus ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={stoppingFocus}
              onClick={() => void stopFocus()}
              data-slot="ambient-focus-stop"
            >
              {tShell("stopFocus")}
            </Button>
          ) : null}
          <OfflineCapture />
          <Link
            href="/notifications"
            data-slot="notification-bell"
            aria-label={
              unread > 0
                ? tShell("notificationsUnread", { count: unread })
                : tShell("notifications")
            }
            className="inline-flex items-center gap-1 rounded-[var(--radius)] px-2 py-1 font-mono text-xs hover:bg-accent hover:text-accent-foreground"
          >
            <Bell aria-hidden="true" className="size-4" />
            <span className="nav-label">{tShell("notifications")}</span>
            {unread > 0 ? (
              <span
                data-slot="notification-count"
                className="tabular-nums text-warning"
                aria-hidden="true"
              >
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
          <Button type="button" variant="outline" size="sm" onClick={sidebarButton}>
            {tShell("sidebar")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={signOut} disabled={signingOut}>
            {signingOut ? tShell("signingOut") : tShell("signOut")}
          </Button>
        </header>

        <main className="min-w-0 flex-1 p-4">
          <div className="mx-auto w-full" style={{ maxWidth: "var(--content-max-width)" }}>
            {children}
          </div>
        </main>

        <StatusLine
          path={pathname}
          sync="synced"
          syncLabels={{
            synced: tShell("synced"),
            saving: tShell("saving"),
            offline: tShell("offline"),
          }}
          timerLabel={tShell("focusLabel")}
          timer={focusTimer}
          hints={SHELL_HINTS.map((hint) => ({
            ...hint,
            label: hint.key ? tShortcut(hint.key) : hint.label,
          }))}
        />
      </div>

      {/* Mounted only while open: shadcn's CommandDialog renders its sr-only header outside
          the portal even when closed, which axe reports as content outside a landmark. */}
      {paletteOpen ? (
        <CommandPalette
          open
          onOpenChange={setPaletteOpen}
          onSignOut={() => void signOut()}
          onAskAi={() => {
            setPaletteOpen(false);
            setCopilotOpen(true);
          }}
        />
      ) : null}
      {copilotOpen ? (
        <CopilotOverlay open onOpenChange={setCopilotOpen} prefill={copilotPrompt} />
      ) : null}
      <HelpOverlay open={helpOpen} onOpenChange={setHelpOpen} />
      <GlobalKeyboard />
    </div>
  );
}
