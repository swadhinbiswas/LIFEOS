import type { StatusHint } from "@/components/tui/status-line";

/**
 * Active keybindings (ADR-025): the status line and the `?` help render exactly this list —
 * a binding that does nothing is never advertised (Bubbles rule, RESEARCH §c).
 * Phase 1 ships the shell bindings; each later phase appends its own.
 */
export const HELP_BINDINGS: StatusHint[] = [
  { keys: ["Ctrl", "K"], label: "command palette" },
  { keys: ["["], label: "cycle sidebar" },
  { keys: ["?"], label: "help" },
  { keys: ["Esc"], label: "close" },
];

/** The 2–4 hints the status line shows inline (RESEARCH §c #2). */
export const SHELL_HINTS: StatusHint[] = [
  { keys: ["["], label: "sidebar" },
  { keys: ["Ctrl", "K"], label: "commands" },
  { keys: ["?"], label: "help" },
];
