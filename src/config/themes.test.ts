/**
 * Automated WCAG AA contrast test for every theme token pair (spec §4.2 line 95).
 *
 * Thresholds: 4.5:1 for body-text pairs, 3:1 for UI/focus pairs (accent = focus ring
 * role, chart = data-viz). Divider `--border` has no WCAG threshold of its own — the
 * control boundary is --input, asserted at 3:1 (rationale in ADR-033).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { contrastRatio, suggestNudge } from "@/lib/color";
import { derivedTokens, themes, THEME_PRESET_IDS, type ThemePreset } from "@/config/themes";

const TEXT_MIN = 4.5;
const UI_MIN = 3;

function check(label: string, fg: string, bg: string, min: number): void {
  const ratio = contrastRatio(fg, bg);
  expect(
    ratio,
    `${label}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (need ≥${min}); ` +
      `try ${suggestNudge(fg, bg, min)}`,
  ).toBeGreaterThanOrEqual(min);
}

describe("theme contrast (spec §4.2)", () => {
  for (const id of THEME_PRESET_IDS) {
    const theme: ThemePreset = themes[id];
    const derived = derivedTokens(theme);
    const backgrounds: Array<[string, string]> = [
      ["background", theme.background],
      ["card", theme.card],
    ];

    describe(id, () => {
      for (const [bgName, bg] of backgrounds) {
        it(`body text ≥ 4.5:1 on ${bgName}`, () => {
          check(`${id} foreground×${bgName}`, theme.foreground, bg, TEXT_MIN);
          check(`${id} muted-foreground×${bgName}`, theme.mutedForeground, bg, TEXT_MIN);
          check(`${id} primary×${bgName}`, theme.primary, bg, TEXT_MIN);
          check(`${id} success×${bgName}`, theme.success, bg, TEXT_MIN);
          check(`${id} warning×${bgName}`, theme.warning, bg, TEXT_MIN);
          check(`${id} danger×${bgName}`, theme.danger, bg, TEXT_MIN);
          check(`${id} info×${bgName}`, theme.info, bg, TEXT_MIN);
          check(`${id} fg×muted-fill×${bgName}`, theme.foreground, derived.mutedFill, TEXT_MIN);
          check(
            `${id} muted-fg×muted-fill×${bgName}`,
            theme.mutedForeground,
            derived.mutedFill,
            TEXT_MIN,
          );
          check(
            `${id} fg×secondary-fill×${bgName}`,
            theme.foreground,
            derived.secondaryFill,
            TEXT_MIN,
          );
          check(`${id} fg×accent-ui-fill×${bgName}`, theme.foreground, derived.accentUi, TEXT_MIN);
        });

        it(`on-color text ≥ 4.5:1 on ${bgName}`, () => {
          check(
            `${id} primary-fg×primary×${bgName}`,
            derived.primaryForeground,
            theme.primary,
            TEXT_MIN,
          );
          check(
            `${id} secondary-fg×secondary×${bgName}`,
            derived.secondaryForeground,
            derived.secondaryFill,
            TEXT_MIN,
          );
          check(
            `${id} destructive-fg×destructive×${bgName}`,
            derived.destructiveForeground,
            derived.destructive,
            TEXT_MIN,
          );
        });

        it(`UI/focus pairs ≥ 3:1 on ${bgName}`, () => {
          check(`${id} input×${bgName}`, derived.input, bg, UI_MIN);
          check(`${id} accent(focus/ring)×${bgName}`, theme.accent, bg, UI_MIN);
          derived.chart.forEach((chart, i) => {
            check(`${id} chart-${i + 1}×${bgName}`, chart, bg, UI_MIN);
          });
        });
      }
    });
  }
});

describe("derived-token formula parity with globals.css", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8");

  it("globals.css uses the same color-mix formulas as derivedTokens()", () => {
    expect(css).toContain("color-mix(in srgb, var(--foreground) 7%");
    expect(css).toContain("color-mix(in srgb, var(--foreground) 8%");
    expect(css).toContain("color-mix(in srgb, var(--foreground) 5%");
    expect(css).toContain("color-mix(in srgb, var(--border) 50%");
    expect(css).toContain("--primary-foreground: var(--background)");
    expect(css).toContain("--ring: var(--accent)");
    expect(css).toContain("--chart-1: var(--primary)");
    expect(css).toContain("--chart-4: var(--destructive)");
    expect(css).toContain("--chart-5: var(--info)");
  });

  it("every preset base block exists in globals.css", () => {
    for (const id of THEME_PRESET_IDS) {
      expect(css, `missing [data-theme=\"${id}\"] block`).toContain(`[data-theme="${id}"]`);
    }
  });
});
