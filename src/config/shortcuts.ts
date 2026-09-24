import type { StatusHint } from "@/components/tui/status-line";

/**
 * Active keybindings (ADR-025 / ADR-060): the status line, the `?` cheat-sheet and the boards' key
 * handling all derive from this list, so a key that does nothing can never be advertised — and a key
 * that works is always documented (the Bubbles rule, RESEARCH §c). `label` is the English default;
 * `key` is the message key the shell and cheat-sheet translate (`Shortcuts`).
 */

export interface BindingGroup {
  title: string;
  /** Message key for the group heading. */
  titleKey: string;
  hints: StatusHint[];
}

export const KEY_BINDINGS: BindingGroup[] = [
  {
    title: "Global",
    titleKey: "groupGlobal",
    hints: [
      { keys: ["Ctrl", "K"], label: "command palette", key: "commandPalette" },
      { keys: ["g", "t"], label: "tasks", key: "tasks" },
      { keys: ["g", "i"], label: "inbox", key: "inbox" },
      { keys: ["g", "c"], label: "calendar", key: "calendar" },
      { keys: ["g", "b"], label: "boards", key: "boards" },
      { keys: ["g", "n"], label: "notifications", key: "notifications" },
      { keys: ["g", "s"], label: "settings", key: "settings" },
      { keys: ["n"], label: "new item", key: "newItem" },
      { keys: ["/"], label: "search", key: "search" },
      { keys: ["t"], label: "toggle theme", key: "toggleTheme" },
      { keys: ["["], label: "cycle sidebar", key: "sidebar" },
      { keys: ["?"], label: "help", key: "help" },
      { keys: ["Esc"], label: "close", key: "close" },
    ],
  },
  {
    title: "Board",
    titleKey: "groupBoard",
    hints: [
      { keys: ["j", "k"], label: "move focus", key: "moveFocus" },
      { keys: ["h", "l"], label: "change column", key: "changeColumn" },
      { keys: ["Enter"], label: "open card", key: "openCard" },
      { keys: ["Space"], label: "complete", key: "complete" },
      { keys: ["x"], label: "select", key: "select" },
      { keys: ["Shift", "J/K"], label: "reorder", key: "reorder" },
      { keys: ["Del"], label: "delete", key: "delete" },
      { keys: ["c"], label: "carry over overdue", key: "carryOver" },
      { keys: ["1", "2"], label: "table / kanban", key: "views" },
      { keys: ["Ctrl", "Z"], label: "undo", key: "undo" },
      { keys: ["Ctrl", "Shift", "Z"], label: "redo", key: "redo" },
    ],
  },
];

/** `g`-prefixed navigation targets (ADR-025: only routes that exist). */
export const GOTO_TARGETS: Record<string, string> = {
  t: "/tasks",
  i: "/inbox",
  c: "/calendar",
  b: "/boards",
  n: "/notifications",
  s: "/settings",
  a: "/settings/appearance",
};

/** The 3–4 hints shown inline in the status line (RESEARCH §c #2). */
export const SHELL_HINTS: StatusHint[] = [
  { keys: ["g", "t"], label: "tasks", key: "tasks" },
  { keys: ["n"], label: "new", key: "newItem" },
  { keys: ["Ctrl", "K"], label: "commands", key: "commandPalette" },
  { keys: ["?"], label: "help", key: "help" },
];
