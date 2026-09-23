import * as React from "react";
import { cn } from "cn";

import { Kbd } from "./kbd";

/** Vim-ish mode chip — only shown when passed (spec §4.3: modal editing off by default). */
export type StatusMode = "NORMAL" | "INSERT" | "COMMAND";

export type SyncState = "synced" | "saving" | "offline";

export interface StatusHint {
  /** One entry per key cap; `["Ctrl", "K"]` renders `Ctrl + K`. */
  keys: string[];
  label: string;
}

/** Glyph + word + named tone per state (RESEARCH §c #5: color never the only signal). */
const SYNC: Record<SyncState, { glyph: string; label: string; tone: string }> = {
  synced: { glyph: "●", label: "synced", tone: "text-success" },
  saving: { glyph: "◌", label: "saving", tone: "text-warning" },
  offline: { glyph: "○", label: "offline", tone: "text-muted-foreground" },
};

export interface StatusLineProps extends React.ComponentProps<"footer"> {
  mode?: StatusMode;
  /** Current view path, e.g. `/boards/roadmap`. */
  path?: string;
  sync?: SyncState;
  /** Focus timer rendered verbatim (tabular figures), e.g. "24:31". */
  timer?: string;
  /**
   * 4–6 context-sensitive key hints in one accent color, right side (RESEARCH §c #2).
   * The row truncates with `…`, it never wraps (RESEARCH §c #4).
   */
  hints?: StatusHint[];
}

/**
 * The persistent vim/tmux-style bottom bar (spec §4.1): mode, view path, sync state,
 * focus timer and the contextual key-hint row. Purely presentational — the shell feeds it
 * from app state when the (app) routes land.
 */
export function StatusLine({
  mode,
  path,
  sync,
  timer,
  hints,
  className,
  ...props
}: StatusLineProps) {
  const syncMeta = sync ? SYNC[sync] : undefined;
  return (
    <footer
      data-slot="status-line"
      className={cn(
        "flex h-7 shrink-0 items-center gap-3 overflow-hidden border-t border-border bg-background px-2 font-mono text-xs",
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 shrink items-center gap-3">
        {mode ? (
          <span className="shrink-0 border border-border px-1 font-semibold tracking-wide">
            {mode}
          </span>
        ) : null}
        {path ? (
          <span className="min-w-0 max-w-64 truncate text-muted-foreground">{path}</span>
        ) : null}
        {syncMeta ? (
          <span className={cn("inline-flex shrink-0 items-center gap-1", syncMeta.tone)}>
            <span aria-hidden="true">{syncMeta.glyph}</span>
            {syncMeta.label}
          </span>
        ) : null}
      </span>

      <span className="ml-auto flex min-w-0 items-center gap-3">
        {timer ? (
          <span className="shrink-0 tabular-nums">
            <span className="text-muted-foreground">focus </span>
            {timer}
          </span>
        ) : null}
        {hints && hints.length > 0 ? (
          <span data-slot="status-hints" className="min-w-0 flex-1 truncate text-primary">
            {hints.map((hint, index) => (
              <span
                key={`${hint.keys.join("+")}-${hint.label}`}
                className={cn("inline-flex items-center gap-1", index > 0 && "ml-3")}
              >
                {hint.keys.map((key, keyIndex) => (
                  <React.Fragment key={key}>
                    {keyIndex > 0 ? <span aria-hidden="true"> + </span> : null}
                    <Kbd className="text-primary">{key}</Kbd>
                  </React.Fragment>
                ))}
                <span className="ml-1">{hint.label}</span>
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </footer>
  );
}
