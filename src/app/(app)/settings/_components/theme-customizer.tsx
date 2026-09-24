"use client";

import { useTranslations } from "next-intl";

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

function PresetControl() {
  const t = useTranslations("Pages.Appearance");
  const preset = useThemeStore((state) => state.overrides.preset);
  const setOverride = useThemeStore((state) => state.set);

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
        {t("preset")}
      </legend>
      <div role="radiogroup" aria-label={t("preset")} className="flex flex-wrap gap-1">
        {THEME_PRESET_IDS.map((id) => {
          const checked = preset === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => {
                // ADR-024: choosing a preset switches to that preset's native colour mode.
                setOverride("preset", id);
                setOverride("colorMode", themes[id].nativeMode);
              }}
              className={cn(
                "rounded-[var(--radius)] border px-2 py-1 font-mono text-xs",
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground",
              )}
            >
              {themes[id].label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function AccentControl() {
  const t = useTranslations("Pages.Appearance");
  const accent = useThemeStore((state) => state.overrides.accent);
  const preset = useThemeStore((state) => state.overrides.preset);
  const setOverride = useThemeStore((state) => state.set);

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="accent">{t("accent")}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="accent"
          type="color"
          value={accent ?? themes[preset].primary}
          onChange={(event) => setOverride("accent", event.target.value)}
          className="h-8 w-14 p-1"
        />
        <span className="font-mono text-xs text-muted-foreground">
          {accent ?? t("presetDefault")}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOverride("accent", null)}
          disabled={accent === null}
        >
          {t("clear")}
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
  const t = useTranslations("Pages.Appearance");
  const replace = useThemeStore((state) => state.replace);

  const colorModes = COLOR_MODES.map((option) => ({
    ...option,
    label: t(
      option.id === "light" ? "colorLight" : option.id === "dark" ? "colorDark" : "colorSystem",
    ),
  }));
  const ligatureOptions = [
    { id: "off" as const, label: t("ligOff") },
    { id: "on" as const, label: t("ligOn") },
  ];
  const scaleOptions = SCALES.map((option) => ({
    ...option,
    label: t(option.id === "sm" ? "scaleSm" : option.id === "md" ? "scaleMd" : "scaleLg"),
  }));
  const radiusOptions = RADII.map((option) => ({
    ...option,
    label: t(
      option.id === "none"
        ? "radiusNone"
        : option.id === "sm"
          ? "radiusSm"
          : option.id === "md"
            ? "radiusMd"
            : "radiusLg",
    ),
  }));
  const layoutOptions = LAYOUTS.map((option) => ({
    ...option,
    label: t(option.id === "compact" ? "layoutCompact" : "layoutFull"),
  }));
  const sidebarVariantOptions = SIDEBAR_VARIANTS.map((option) => ({
    ...option,
    label: t(
      option.id === "flush"
        ? "sidebarFlush"
        : option.id === "inset"
          ? "sidebarInset"
          : "sidebarFloating",
    ),
  }));
  const sidebarModeOptions = SIDEBAR_MODES.map((option) => ({
    ...option,
    label: t(
      option.id === "expanded" ? "modeExpanded" : option.id === "icon" ? "modeIcon" : "modeFull",
    ),
  }));

  return (
    <div className="grid gap-4">
      <Panel title={t("palette")}>
        <PresetControl />
        <Segmented axis="colorMode" legend={t("colorMode")} options={colorModes} />
      </Panel>

      <Panel title={t("typography")}>
        <Segmented axis="font" legend={t("font")} options={FONTS} />
        <Segmented axis="ligatures" legend={t("ligatures")} options={ligatureOptions} />
      </Panel>

      <Panel title={t("geometry")}>
        <Segmented axis="scale" legend={t("scale")} options={scaleOptions} />
        <Segmented axis="radius" legend={t("radius")} options={radiusOptions} />
        <Segmented axis="layout" legend={t("contentLayout")} options={layoutOptions} />
      </Panel>

      <Panel title={t("sidebarPanel")}>
        <Segmented
          axis="sidebarVariant"
          legend={t("sidebarVariant")}
          options={sidebarVariantOptions}
        />
        <Segmented axis="sidebarMode" legend={t("sidebarMode")} options={sidebarModeOptions} />
      </Panel>

      <Panel title={t("accentPanel")}>
        <AccentControl />
      </Panel>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => replace(DEFAULT_THEME)}>
          {t("reset")}
        </Button>
      </div>
    </div>
  );
}
