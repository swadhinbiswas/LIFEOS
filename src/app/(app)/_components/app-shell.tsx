"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, PanelLeft, Search, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { StatusLine } from "@/components/tui/status-line";
import { Button } from "@/components/ui/button";
import { controlGhost } from "@/components/tui/controls";
import { APP_NAME } from "@/config/app";
import { NAV_SECTIONS, NAV_ITEMS } from "@/config/nav";
import { Kbd } from "@/components/tui/kbd";
import { SHELL_HINTS } from "@/config/shortcuts";
import { stopFocusAction } from "@/server/focus/actions";
import { authClient } from "@/lib/auth-client";
import { useCollapsedSections } from "./use-collapsed-nav";
import { useThemeStore } from "@/lib/theme-store";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/use-media-query";
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
/**
 * The rail's fold control, in the footer tier rather than boxed like a toolbar button (ADR-117).
 *
 * A real `<button>` with `aria-controls` and `aria-expanded` pointing at the nav it folds, because on
 * a phone it is also the drawer's only close control. The scrim works too, but a scrim is not
 * something a keyboard or a screen reader can operate.
 */
function SidebarControl({
  onClick,
  label,
  children,
  expanded,
  controls,
  slot = "sidebar-toggle",
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  expanded: boolean | undefined;
  controls: string;
  /** Two of these exist below the breakpoint, so a test must be able to say which it means. */
  slot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-controls={controls}
      aria-expanded={expanded}
      aria-label={label}
      data-slot={slot}
      className={cn(controlGhost, "shrink-0 px-2")}
    >
      {children}
    </button>
  );
}

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
  const { collapsed: collapsedSections, toggle: toggleSection } = useCollapsedSections();
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotPrompt, setCopilotPrompt] = useState<string | undefined>(undefined);
  const [helpOpen, setHelpOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [stoppingFocus, setStoppingFocus] = useState(false);
  // ADR-103: below the breakpoint the sidebar is an off-canvas drawer, so the header button and
  // the `[` shortcut drive this instead of the ADR-028 width cycle.
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // The current page's label, from the nav registry — the header shows where you are (spec §3.3).
  const pageTitle =
    NAV_ITEMS.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)
      .map((item) => tNav(item.key))[0] ?? tShell("tagline");

  const stopFocus = async () => {
    if (!focus) return;
    setStoppingFocus(true);
    await stopFocusAction({ sessionId: focus.id });
    setStoppingFocus(false);
    router.refresh();
  };

  // Derived, not synced: entering `full` reveals the bar; Esc/`[` dismiss it (ADR-028).
  const overlayOpen = sidebarMode === "full" && !overlayDismissed;

  // A drawer that survives a navigation is a drawer covering the page you just asked for, and one
  // that survives a rotation into the desktop layout is a sidebar stuck open. Both are state
  // derived from a value that already changed, so they are adjusted during render (React's
  // documented pattern) rather than in an effect that would flash the stale frame.
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (pathname !== drawerPath) {
    setDrawerPath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }
  if (!isMobile && drawerOpen) setDrawerOpen(false);

  const cycleSidebar = useCallback(() => {
    const index = SIDEBAR_MODES.indexOf(sidebarMode);
    const next = SIDEBAR_MODES[(index + 1) % SIDEBAR_MODES.length] ?? "expanded";
    setOverlayDismissed(false);
    setOverride("sidebarMode", next);
  }, [setOverride, sidebarMode]);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setDrawerOpen((open) => !open);
      return;
    }
    if (sidebarMode === "full") {
      setOverlayDismissed((dismissed) => !dismissed);
      return;
    }
    cycleSidebar();
  }, [cycleSidebar, isMobile, sidebarMode]);

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
        toggleSidebar();
      } else if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      } else if (event.key === "Escape" && (overlayOpen || drawerOpen)) {
        if (drawerOpen) setDrawerOpen(false);
        else setOverlayDismissed(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, overlayOpen, toggleSidebar]);

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

  const sidebarButtonLabel = isMobile
    ? drawerOpen
      ? tShell("closeNav")
      : tShell("openNav")
    : tShell("sidebar");

  return (
    <div
      className="app-shell flex min-h-svh overflow-x-hidden bg-background"
      data-overlay={overlayOpen ? "open" : "closed"}
      data-drawer={drawerOpen ? "open" : "closed"}
    >
      {isMobile && drawerOpen ? (
        <button
          type="button"
          aria-label={tShell("closeNav")}
          data-slot="drawer-scrim"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-transparent"
        />
      ) : null}
      <aside
        className="app-sidebar"
        id="primary-nav"
        // Off-canvas is not hidden: without `inert` a phone user can still tab into (and a screen
        // reader still reads) a navigation they cannot see.
        inert={isMobile && !drawerOpen ? true : undefined}
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
          <nav
            data-slot="app-sidebar-nav"
            aria-label={tShell("primaryNav")}
            // `scroll-tui` rather than the OS default: this nav overflows on any normal laptop, and
            // the platform's gutter is a 15px light widget with arrow buttons down the side of a
            // 250px column. Themed, it is 10px, arrowless, and the same paint as everything else.
            className="scroll-tui flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2"
          >
            {NAV_SECTIONS.map((section) => {
              const items = NAV_ITEMS.filter(
                (item) => section.hrefs.includes(item.href) && (!item.requiresBilling || billing),
              );
              if (items.length === 0) return null;
              // A section holding the page you are on is never foldable: hiding `/career/jobs`
              // behind a label you must click to find again is worse than a long sidebar.
              const holdsCurrentPage = items.some((item) => item.href === pathname);
              const expanded = holdsCurrentPage || !collapsedSections.has(section.id);
              return (
                <div key={section.id} className="flex flex-col gap-0.5" data-slot="nav-section">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    disabled={holdsCurrentPage}
                    aria-expanded={expanded}
                    aria-controls={`nav-section-${section.id}`}
                    data-slot="nav-section-toggle"
                    className={cn(
                      "group flex min-h-6 w-full items-center gap-1 rounded-[var(--radius)] px-2 py-0.5",
                      "font-mono text-[10px] tracking-wider text-muted-foreground uppercase",
                      "hover:text-foreground",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      // Disabled rather than hidden, so the row keeps its place and its height, and
                      // the reason it cannot fold is discoverable instead of mysterious.
                      holdsCurrentPage && "cursor-default",
                    )}
                    title={
                      holdsCurrentPage
                        ? tNav(section.key)
                        : `${tNav(section.key)} — ${expanded ? tShell("collapseSection") : tShell("expandSection")}`
                    }
                  >
                    {/* A chevron that points the way the section opens. `aria-hidden` because the
                        accessible state is `aria-expanded` on the button itself. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "text-[9px] transition-transform",
                        expanded ? "rotate-90" : "rotate-0",
                        !holdsCurrentPage && "group-hover:text-foreground",
                      )}
                    >
                      ›
                    </span>
                    <span className="truncate">{tNav(section.key)}</span>
                  </button>
                  {/* Not unmounted when folded: a folded section keeps its links in the DOM, so
                      `Cmd-K` and a screen reader's link list still find them. `hidden` is what takes
                      them out of the tab order and the accessibility tree. */}
                  <div
                    id={`nav-section-${section.id}`}
                    hidden={!expanded}
                    className="flex flex-col gap-0.5"
                  >
                    {items.map(({ href, key, icon: Icon }) => {
                      const label = tNav(key);
                      const active = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          aria-current={active ? "page" : undefined}
                          title={label}
                          className={cn(
                            "flex min-h-7 items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 font-mono text-xs",
                            "hover:bg-accent hover:text-accent-foreground",
                            active && "bg-accent text-accent-foreground",
                          )}
                        >
                          <Icon aria-hidden="true" className="size-4 shrink-0" />
                          <span className="nav-label truncate">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
          {/*
            The account and session controls live here, at the bottom of the rail, beside Profile —
            not in the top bar (ADR-130). The top bar's job is to say where you are; these four are
            about *you* and about getting out, and a row of them beside the page title meant the
            sidebar had one job and the header had two.

            Order is deliberate and follows the frequency ladder: the fold and the search are used
            constantly, the bell occasionally, the session almost never.
          */}
          <div
            className="flex flex-col gap-1 border-t border-border px-2 py-2"
            data-slot="sidebar-footer"
          >
            <div className="flex items-center gap-1">
              <SidebarControl
                onClick={toggleSidebar}
                label={sidebarButtonLabel}
                expanded={isMobile ? drawerOpen : sidebarMode === "full" ? overlayOpen : undefined}
                controls="primary-nav"
                slot={isMobile ? "drawer-close" : "sidebar-toggle"}
              >
                {isMobile ? (
                  <X aria-hidden="true" className="size-4" />
                ) : (
                  <PanelLeft aria-hidden="true" className="size-4" />
                )}
              </SidebarControl>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                data-slot="sidebar-search"
                aria-label={tShell("search")}
                className={cn(controlGhost, "flex-1 justify-start gap-2")}
              >
                <Search aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="nav-label truncate">{tShell("search")}</span>
                <Kbd aria-hidden="true" className="ml-auto hidden lg:inline">
                  Ctrl
                </Kbd>
                <Kbd aria-hidden="true" className="hidden lg:inline">
                  K
                </Kbd>
              </button>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/notifications"
                data-slot="notification-bell"
                aria-label={
                  unread > 0
                    ? tShell("notificationsUnread", { count: unread })
                    : tShell("notifications")
                }
                className={cn(controlGhost, "flex-1 justify-start gap-2")}
              >
                <Bell aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="nav-label truncate">{tShell("notifications")}</span>
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
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                data-slot="sign-out"
                aria-label={signingOut ? tShell("signingOut") : tShell("signOut")}
                className={cn(controlGhost, "shrink-0")}
              >
                <LogOut aria-hidden="true" className="size-3.5" />
              </button>
            </div>
            {/* The Profile row, which the controls sit beside: the one place that is about the
                person rather than the session. `/settings` is where the profile actually lives. */}
            <Link
              href="/settings"
              data-slot="profile-row"
              aria-current={pathname === "/settings" ? "page" : undefined}
              className={cn(
                "flex min-h-7 items-center gap-2 rounded-[var(--radius)] px-2 py-1 font-mono text-xs",
                "hover:bg-accent hover:text-accent-foreground",
                pathname === "/settings" && "bg-accent text-accent-foreground",
              )}
            >
              <UserRound aria-hidden="true" className="size-4 shrink-0" />
              <span className="nav-label truncate">{user.name}</span>
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-3 py-2">
          {/* The location indicator (spec §3.3), deliberately *quieter* than the page's own `h1`.
              These are usually the same two words, and at equal weight they read as a title typed
              twice — which is what every route looked like. Demoting this to the muted foreground
              marks it as chrome while keeping it legible, because below the breakpoint the sidebar
              is a drawer and this is the only statement of where you are (ADR-103). */}
          <p className="nav-label min-w-0 flex-1 truncate font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {pageTitle}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {/* The nav opener, on a phone only (ADR-130).
                Everywhere else the rail is always on screen and its fold control lives in the footer
                with the rest. Below the breakpoint the rail is off-canvas, so a control that lived
                inside it would be inside the thing it opens — the drawer could be closed by its
                scrim and opened by nothing. `mobile.spec.ts` caught exactly that. */}
            {isMobile ? (
              <SidebarControl
                onClick={toggleSidebar}
                label={sidebarButtonLabel}
                expanded={drawerOpen}
                controls="primary-nav"
              >
                {drawerOpen ? (
                  <X aria-hidden="true" className="size-4" />
                ) : (
                  <Menu aria-hidden="true" className="size-4" />
                )}
              </SidebarControl>
            ) : null}
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
          </div>
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
