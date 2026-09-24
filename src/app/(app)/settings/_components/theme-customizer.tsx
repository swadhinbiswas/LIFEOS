"use client";

import { Panel } from "@/components/tui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COLOR_MODES,
  DEFAULT_THEME,
  FONTS,
  LAYOUTS,
  RADII,
  SCALES,
  SIDEBAR_MODES,
  SIDEBAR_VARIANTS,
  THEME_PRESET_IDS,
  themes,
  type ThemeOverrides,
} from "@/config/themes";
import { useThemeStore } from "@/lib/theme-store";
import { cn } from "@/lib/utils";

/** The string-valued axes a segmented control can drive (`accent` has its own picker). */
type StringAxis =
  | "preset"
  | "colorMode"
  | "font"
  | "ligatures"
  | "radius"
  | "layout"
  | "scale"
  | "sidebarVariant"
  | "sidebarMode";

const PRESET_OPTIONS = THEME_PRESET_IDS.map((id) => ({ id, label: themes[id].label }));
const LIGATURE_OPTIONS = [
  { id: "off", label: "Off" },
  { id: "on", label: "On" },
] as const;

function Segmented<K extends StringAxis>({
  axis,
  legend,
  options,
}: {
  axis: K;
  legend: string;
  options: ReadonlyArray<{ id: ThemeOverrides[K]; label: string }>;
}) {
  const value = useThemeStore((state) => state.overrides[axis]);
  const setOverride = useThemeStore((state) => state.set);

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
        {legend}
      </legend>
      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-1">
        {options.map((option) => {
          const checked = value === option.id;
          return (
            /* Plain buttons with explicit token colours (no opacity modifiers or shadows):
               axe's colour resolver cannot parse `color-mix(in oklab, …)`, so shadcn's
               opacity-modifier hovers make it fall back to pixel sampling and report false
               contrast failures for these controls. */
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setOverride(axis, option.id)}
              className={cn(
                "rounded-[var(--radius)] border px-2 py-1 font-mono text-xs",
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function AccentControl() {
  const accent = useThemeStore((state) => state.overrides.accent);
  const preset = useThemeStore((state) => state.overrides.preset);
  const setOverride = useThemeStore((state) => state.set);

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="accent">accent</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="accent"
          type="color"
          value={accent ?? themes[preset].primary}
          onChange={(event) => setOverride("accent", event.target.value)}
          className="h-8 w-14 p-1"
        />
        <span className="font-mono text-xs text-muted-foreground">
          {accent ?? "preset default"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOverride("accent", null)}
          disabled={accent === null}
        >
          clear
        </Button>
      </div>
    </div>
  );
}

/**
 * The customizer (spec §4.2 / RESEARCH §a matrix). Every control writes to the live store —
 * the attributes on `<html>` change immediately, and the shell's ThemeSync persists the set
 * to the cookie and (when signed in) `user_settings.theme_overrides` (ADR-024).
 */
export function ThemeCustomizer() {
  const replace = useThemeStore((state) => state.replace);

  return (
    <div className="grid gap-4">
      <Panel title="Palette">
        <Segmented axis="preset" legend="preset" options={PRESET_OPTIONS} />
        <Segmented axis="colorMode" legend="color mode" options={COLOR_MODES} />
      </Panel>

      <Panel title="Typography">
        <Segmented axis="font" legend="font" options={FONTS} />
        <Segmented axis="ligatures" legend="ligatures" options={LIGATURE_OPTIONS} />
      </Panel>

      <Panel title="Geometry">
        <Segmented axis="scale" legend="scale" options={SCALES} />
        <Segmented axis="radius" legend="radius" options={RADII} />
        <Segmented axis="layout" legend="content layout" options={LAYOUTS} />
      </Panel>

      <Panel title="Sidebar">
        <Segmented axis="sidebarVariant" legend="sidebar variant" options={SIDEBAR_VARIANTS} />
        <Segmented axis="sidebarMode" legend="sidebar mode" options={SIDEBAR_MODES} />
      </Panel>

      <Panel title="Accent">
        <AccentControl />
      </Panel>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => replace(DEFAULT_THEME)}>
          reset to defaults
        </Button>
      </div>
    </div>
  );
}
