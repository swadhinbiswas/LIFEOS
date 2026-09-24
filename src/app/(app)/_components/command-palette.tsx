"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/config/nav";
import { COLOR_MODES, SIDEBAR_MODES, THEME_PRESET_IDS, themes } from "@/config/themes";
import { useThemeStore } from "@/lib/theme-store";
import { captureTaskAction } from "@/server/capture/actions";
import { searchAction } from "@/server/search/actions";

/**
 * Command palette (spec §4.3): fuzzy search over cards and boards, the quick-capture grammar
 * as a "create task" action, plus navigation, theme/colour-mode/sidebar switching and sign
 * out. Only implemented commands appear (ADR-025) — no Ask-AI row, no entity types that do
 * not exist yet.
 *
 * `CommandDialog` does not provide the cmdk root, so this renders `Command` itself. Filtering
 * is off: results are already server-filtered, and the action groups are swapped out while a
 * query is present, so nothing has to be filtered twice.
 */
export function CommandPalette({
  open,
  onOpenChange,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setOverride = useThemeStore((state) => state.set);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const close = () => {
    onOpenChange(false);
    setQuery("");
    setDebounced("");
  };

  const results = useQuery({
    queryKey: ["search", debounced],
    queryFn: async () => {
      const result = await searchAction({ query: debounced });
      return result.ok ? result.data : { cards: [], boards: [] };
    },
    enabled: debounced.length >= 2,
  });

  const create = useMutation({
    mutationFn: async (text: string) => {
      const result = await captureTaskAction({ text });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: ({ id }) => {
      close();
      // The new card must be in the board cache, or the deep-linked sheet has nothing to open.
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      router.push(`/tasks?card=${id}`);
    },
  });

  const run = (action: () => void) => () => {
    close();
    action();
  };

  const hasQuery = query.trim() !== "";
  const cards = results.data?.cards ?? [];
  const boards = results.data?.boards ?? [];

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Command palette"
      description="Search cards and boards, or run an action"
    >
      <Command shouldFilter={false}>
        {/* A plain input rather than cmdk's: its Input omits onChange, and with
            `shouldFilter={false}` cmdk only needs to own selection/Enter, which still works
            because key events bubble to the Command root. */}
        <div className="p-1 pb-0">
          <label className="sr-only" htmlFor="palette-search">
            search cards and boards, or type a task
          </label>
          <input
            id="palette-search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="search cards and boards, or type a task…"
            className="h-8 w-full border border-border bg-background px-2 font-mono text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <CommandList>
          <CommandEmpty>
            {create.isPending
              ? "creating…"
              : results.isFetching
                ? "searching…"
                : "no matching command"}
          </CommandEmpty>

          {hasQuery ? (
            <>
              {cards.length > 0 ? (
                <CommandGroup heading="Cards">
                  {cards.map((hit) => (
                    <CommandItem
                      key={hit.id}
                      value={`card ${hit.id}`}
                      onSelect={run(() =>
                        router.push(
                          hit.isSystem
                            ? `/tasks?card=${hit.id}`
                            : `/boards/${hit.boardId}?card=${hit.id}`,
                        ),
                      )}
                    >
                      <span className="truncate">{hit.title}</span>
                      <CommandShortcut>{hit.boardName}</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {boards.length > 0 ? (
                <CommandGroup heading="Boards">
                  {boards.map((hit) => (
                    <CommandItem
                      key={hit.id}
                      value={`board ${hit.id}`}
                      onSelect={run(() => router.push(`/boards/${hit.id}`))}
                    >
                      {hit.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              <CommandGroup heading="Create">
                <CommandItem
                  value={`create ${query}`}
                  onSelect={() => create.mutate(query.trim())}
                  disabled={create.isPending}
                >
                  create task: {query.trim()}
                </CommandItem>
              </CommandGroup>
            </>
          ) : (
            <>
              <CommandGroup heading="Navigate">
                {NAV_ITEMS.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`go ${item.label}`}
                    onSelect={run(() => router.push(item.href))}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Theme">
                {THEME_PRESET_IDS.map((id) => (
                  <CommandItem
                    key={id}
                    value={`theme ${themes[id].label}`}
                    onSelect={run(() => {
                      // ADR-024: choosing a preset switches to that preset's native colour mode.
                      setOverride("preset", id);
                      setOverride("colorMode", themes[id].nativeMode);
                    })}
                  >
                    {themes[id].label}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Colour mode">
                {COLOR_MODES.map((mode) => (
                  <CommandItem
                    key={mode.id}
                    value={`colour mode ${mode.label}`}
                    onSelect={run(() => setOverride("colorMode", mode.id))}
                  >
                    {mode.label}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Sidebar">
                {SIDEBAR_MODES.map((mode) => (
                  <CommandItem
                    key={mode.id}
                    value={`sidebar ${mode.label}`}
                    onSelect={run(() => setOverride("sidebarMode", mode.id))}
                  >
                    {mode.label}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Account">
                <CommandItem value="sign out" onSelect={run(onSignOut)}>
                  Sign out
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
