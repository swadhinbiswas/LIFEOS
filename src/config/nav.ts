import {
  BarChart3,
  Bot,
  Briefcase,
  CalendarDays,
  CreditCard,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  ListTodo,
  Palette,
  MessageSquareQuote,
  Repeat,
  NotebookPen,
  Timer,
  ClipboardCheck,
  GraduationCap,
  HeartPulse,
  Wallet,
  Target,
  Sparkles,
  Info,
  KeyRound,
  FileCode,
  Trash2,
  UserRound,
  type LucideIcon,
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
  { href: "/career/analytics", key: "analytics", icon: BarChart3 },
  { href: "/career/portfolio", key: "portfolio", icon: Sparkles },
  { href: "/career/interview-prep", key: "prep", icon: MessageSquareQuote },
  { href: "/settings", key: "profile", icon: UserRound },
  { href: "/settings/billing", key: "billing", icon: CreditCard, requiresBilling: true },
  { href: "/settings/integrations", key: "integrations", icon: KeyRound },
  { href: "/settings/ai", key: "aiSettings", icon: Bot },
  { href: "/docs/api", key: "api", icon: FileCode },
  { href: "/settings/appearance", key: "appearance", icon: Palette },
  { href: "/about", key: "about", icon: Info },
];
