import {
  Briefcase,
  Inbox,
  LayoutGrid,
  ListTodo,
  Palette,
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
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/boards", label: "Boards", icon: LayoutGrid },
  { href: "/career/jobs", label: "Jobs", icon: Briefcase },
  { href: "/settings", label: "Profile", icon: UserRound },
  { href: "/settings/appearance", label: "Appearance", icon: Palette },
];
