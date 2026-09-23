/** App-wide constants (spec §7.2 config/app.ts). No fabricated facts — values only from prompt.md. */

export const APP_NAME = "LifeOS";
export const APP_TAGLINE = "A free, open, AI-connected personal operating system";
export const APP_DESCRIPTION =
  "Kanban/tasks, career/CV, habits, notes and finance in a keyboard-first, TUI-skinned web app.";

/** Theme settings cookie — read by the root layout for FOUC-free first paint (ADR-024). */
export const THEME_COOKIE = "lifeos-theme";
