import {
  BarChart3,
  BellRing,
  BookOpen,
  Bot,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Database,
  FileCode,
  FileText,
  GraduationCap,
  HeartPulse,
  Inbox,
  Info,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  ListTodo,
  MessageSquareQuote,
  NotebookPen,
  Palette,
  Repeat,
  Sparkles,
  Target,
  Timer,
  Trash2,
  type LucideIcon,
  UserRound,
  Wallet,
} from "lucide-react";

/**
 * Navigation (ADR-025 / ADR-060): only routes that exist today. The label is a **message key**,
 * resolved by the shell and command palette from `messages/*.json`, so the chrome is translated in
 * one place. Out-of-phase destinations are never stubbed (spec §1 — no dead UI).
 */
export interface NavItem {
  href: string;
  /** Key under the `Nav` namespace in the message catalog. */
  key: string;
  icon: LucideIcon;
  /** Only shown when billing is enabled (ADR-082) — there is no billing UI otherwise. */
  requiresBilling?: boolean;
}

/**
 * Sidebar sections (spec §3.3: reproduce the reference's labelled groups). Order is the display
 * order; an item not listed here still renders, in a trailing "more" group, so a new route is never
 * silently hidden.
 */
export interface NavSection {
  id: string;
  /** Key under `Nav`, e.g. `sectionWork`. */
  key: string;
  hrefs: string[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "work",
    key: "sectionWork",
    hrefs: ["/dashboard", "/ai", "/tasks", "/inbox", "/calendar", "/reviews"],
  },
  {
    id: "life",
    key: "sectionLife",
    hrefs: ["/habits", "/goals", "/notes", "/focus", "/finance", "/health", "/learning"],
  },
  { id: "build", key: "sectionBuild", hrefs: ["/boards", "/trash"] },
  {
    id: "career",
    key: "sectionCareer",
    hrefs: [
      "/career/jobs",
      "/career/cv",
      "/career/analytics",
      "/career/portfolio",
      "/career/interview-prep",
    ],
  },
  {
    id: "system",
    key: "sectionSystem",
    hrefs: [
      "/settings",
      "/settings/billing",
      "/settings/integrations",
      "/settings/ai",
      "/settings/data",
      "/docs",
      "/docs/api",
      "/settings/appearance",
      "/about",
    ],
  },
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/ai", key: "copilot", icon: Sparkles },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  { href: "/reviews", key: "reviews", icon: ClipboardCheck },
  { href: "/tasks", key: "tasks", icon: ListTodo },
  { href: "/habits", key: "habits", icon: Repeat },
  { href: "/goals", key: "goals", icon: Target },
  { href: "/notes", key: "notes", icon: NotebookPen },
  { href: "/focus", key: "focus", icon: Timer },
  { href: "/finance", key: "finance", icon: Wallet },
  { href: "/health", key: "health", icon: HeartPulse },
  { href: "/learning", key: "learning", icon: GraduationCap },
  { href: "/inbox", key: "inbox", icon: Inbox },
  { href: "/boards", key: "boards", icon: LayoutGrid },
  { href: "/trash", key: "trash", icon: Trash2 },
  { href: "/career/jobs", key: "jobs", icon: Briefcase },
  // Ahead of the pipeline in the list, not after it: a follow-up with a date is the one row that
  // can be late today, and the pipeline is a record rather than a to-do (ADR-114).
  { href: "/career/follow-ups", key: "followUps", icon: BellRing },
  { href: "/career/cv", key: "cv", icon: FileText },
  { href: "/career/analytics", key: "analytics", icon: BarChart3 },
  { href: "/career/portfolio", key: "portfolio", icon: Sparkles },
  { href: "/career/interview-prep", key: "prep", icon: MessageSquareQuote },
  { href: "/settings", key: "profile", icon: UserRound },
  { href: "/settings/billing", key: "billing", icon: CreditCard, requiresBilling: true },
  { href: "/settings/integrations", key: "integrations", icon: KeyRound },
  { href: "/settings/ai", key: "aiSettings", icon: Bot },
  { href: "/settings/data", key: "data", icon: Database },
  { href: "/docs/api", key: "api", icon: FileCode },
  { href: "/docs", key: "docs", icon: BookOpen },
  { href: "/settings/appearance", key: "appearance", icon: Palette },
  { href: "/about", key: "about", icon: Info },
];
