"use client";

import { useRouter } from "next/navigation";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/config/nav";
import { COLOR_MODES, SIDEBAR_MODES, THEME_PRESET_IDS, themes } from "@/config/themes";
import { useThemeStore } from "@/lib/theme-store";

/**
 * Command palette skeleton (ADR-025 / spec §4.4): only commands that work today — navigation
 * to implemented routes, theme/colour-mode/sidebar switching and sign out. No "Ask AI…" row
 * (Phase 6) and no entity search (Phase 2+); later phases flip their groups on here.
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
  const setOverride = useThemeStore((state) => state.set);

  const run = (action: () => void) => () => {
    action();
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Jump to a page or change the theme"
    >
      <CommandInput placeholder="type a command…" />
      <CommandList>
        <CommandEmpty>no matching command</CommandEmpty>

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
      </CommandList>
    </CommandDialog>
  );
}
