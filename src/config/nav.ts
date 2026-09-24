import {
  BarChart3,
  Briefcase,
  Inbox,
  LayoutGrid,
  ListTodo,
  Palette,
  MessageSquareQuote,
  Repeat,
  NotebookPen,
  Target,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/**
 * Navigation (ADR-025): only routes that exist today. Later phases append their own groups
 * here; out-of-phase destinations are never stubbed (spec §1 — no dead UI).
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/boards", label: "Boards", icon: LayoutGrid },
  { href: "/career/jobs", label: "Jobs", icon: Briefcase },
  { href: "/career/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/career/portfolio", label: "Portfolio", icon: Sparkles },
  { href: "/career/interview-prep", label: "Prep", icon: MessageSquareQuote },
  { href: "/settings", label: "Profile", icon: UserRound },
  { href: "/settings/appearance", label: "Appearance", icon: Palette },
];
