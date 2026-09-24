import type { StatusHint } from "@/components/tui/status-line";

/**
 * Active keybindings (ADR-025): the status line, the `?` cheat-sheet and the boards' key
 * handling all derive from this list, so a key that does nothing can never be advertised —
 * and a key that works is always documented (the Bubbles rule, RESEARCH §c).
 *
 * Only implemented commands appear: navigation targets that exist, the two views that exist
 * (1/2 — Grid/Calendar/Timeline are not built yet), and no card modals that are not.
 */

export interface BindingGroup {
  title: string;
  hints: StatusHint[];
}

export const KEY_BINDINGS: BindingGroup[] = [
  {
    title: "Global",
    hints: [
      { keys: ["Ctrl", "K"], label: "command palette" },
      { keys: ["g", "t"], label: "tasks" },
      { keys: ["g", "i"], label: "inbox" },
      { keys: ["g", "b"], label: "boards" },
      { keys: ["g", "s"], label: "settings" },
      { keys: ["n"], label: "new item" },
      { keys: ["/"], label: "search" },
      { keys: ["t"], label: "toggle theme" },
      { keys: ["["], label: "cycle sidebar" },
      { keys: ["?"], label: "help" },
      { keys: ["Esc"], label: "close" },
    ],
  },
  {
    title: "Board",
    hints: [
      { keys: ["j", "k"], label: "move focus" },
      { keys: ["h", "l"], label: "change column" },
      { keys: ["Enter"], label: "open card" },
      { keys: ["Space"], label: "complete" },
      { keys: ["x"], label: "select" },
      { keys: ["Shift", "J/K"], label: "reorder" },
      { keys: ["Del"], label: "delete" },
      { keys: ["c"], label: "carry over overdue" },
      { keys: ["1", "2"], label: "table / kanban" },
    ],
  },
];

/** `g`-prefixed navigation targets (ADR-025: only routes that exist). */
export const GOTO_TARGETS: Record<string, string> = {
  t: "/tasks",
  i: "/inbox",
  b: "/boards",
  s: "/settings",
  a: "/settings/appearance",
};

/** The 3–4 hints shown inline in the status line (RESEARCH §c #2). */
export const SHELL_HINTS: StatusHint[] = [
  { keys: ["g", "t"], label: "tasks" },
  { keys: ["n"], label: "new" },
  { keys: ["Ctrl", "K"], label: "commands" },
  { keys: ["?"], label: "help" },
];
