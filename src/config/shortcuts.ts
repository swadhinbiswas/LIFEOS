import type { StatusHint } from "@/components/tui/status-line";

/**
 * Active keybindings (ADR-025): the status line and the `?` help render exactly this list —
 * a binding that does nothing is never advertised (Bubbles rule, RESEARCH §c).
 * Phase 1 ships the shell bindings; each later phase appends its own.
 */
export const SHELL_HINTS: StatusHint[] = [
  { keys: ["["], label: "sidebar" },
  { keys: ["Esc"], label: "close" },
];
