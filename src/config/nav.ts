import {
  BarChart3,
  Briefcase,
  CalendarDays,
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
  Info,
  Wallet,
  Target,
  Sparkles,
  Trash2,
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
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reviews", label: "Reviews", icon: ClipboardCheck },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/learning", label: "Learning", icon: GraduationCap },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/boards", label: "Boards", icon: LayoutGrid },
  { href: "/trash", label: "Trash", icon: Trash2 },
  { href: "/career/jobs", label: "Jobs", icon: Briefcase },
  { href: "/career/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/career/portfolio", label: "Portfolio", icon: Sparkles },
  { href: "/career/interview-prep", label: "Prep", icon: MessageSquareQuote },
  { href: "/settings", label: "Profile", icon: UserRound },
  { href: "/settings/appearance", label: "Appearance", icon: Palette },
  { href: "/about", label: "About", icon: Info },
];
