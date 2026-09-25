# Theming

LifeOS ships six curated presets and a customizer, all driven by CSS variables. There is **one**
source of truth for colour: `src/config/themes.ts`. Adding a preset means adding one object there and
one block in `src/app/globals.css`; nothing else changes.

## How a theme is applied

1. The server reads the theme cookie (`lifeos-theme`) in the root layout, so the first paint is
   already correct (no flash).
2. `src/config/themes.ts` resolves the preset and the customizer axes into a set of CSS variables.
3. `globals.css` maps those variables onto Tailwind v4 theme tokens (`--color-background`,
   `--color-primary`, `--color-ring`, `--color-chart-1`…), so every component — including the
   shadcn/ui primitives — themes itself.

The contrast test (`src/config/themes.test.ts`) mirrors the `color-mix()` formulas in `globals.css`
and fails if a preset drops below WCAG AA, so a new preset cannot quietly ship unreadable.

## Presets and axes

Presets are named for their native mode: `midnight`, `mocha`, `gruvbox`, `phosphor`, `amber`,
`paper`. Each carries background, card, border, foreground, muted foreground, primary, success,
warning, danger, info and accent.

The customizer composes independent axes (all in `themes.ts`):

| Axis            | Values                                                                           |
| --------------- | -------------------------------------------------------------------------------- |
| Mode            | light, dark                                                                      |
| Font            | the spec's font list                                                             |
| **Text weight** | **Regular (400/600), Medium (450/650), Bold (500/700) — default Bold** (ADR-095) |
| Radius          | none → pill                                                                      |
| Layout          | the TUI-density layout options                                                   |
| Scale           | UI density                                                                       |
| Sidebar         | variant and mode                                                                 |
| Accent          | a named accent that overrides the preset's accent variable                       |

**OpenCode palettes (ADR-096).** All 33 themes OpenCode ships
(`packages/tui/src/theme/assets/*.json`, the list behind <https://opencode.ai/docs/themes/>) are
imported as `oc-*` presets by `scripts/import-opencode-themes.mjs` — colours are **read from those
files, never guessed**. Where a source token cannot clear WCAG AA it is corrected by shifting its
lightness, with the original hex kept in a comment. The customizer lists the 6 LifeOS palettes and
the 33 imported ones as two groups, so 39 chips stay scannable; re-run the script to refresh them.

Settings persist in the cookie and in the `user_settings` row, so a theme follows the account.

## Adding a preset

1. Add the object to `themes` in `src/config/themes.ts` with the base hexes; record the original
   spec hex in a comment if you adjust a value to pass contrast.
2. Add the matching `[data-theme="…"]` block to `src/app/globals.css`.
3. Run `pnpm test` — the contrast test recomputes every derived token and asserts the CSS formulas
   match the TypeScript.
4. Add the label to `messages/*.json` under the theme keys.

## Rules

- **Tokens, not literals.** Components use Tailwind classes backed by tokens (`bg-card`,
  `text-muted-foreground`, `border-border`); a raw hex in a component is a bug.
- **Semantic colours.** `success`, `warning`, `danger` and `info` carry meaning; charts use
  `chart-1…5` so a preset can restate them.
- **TUI skin, not a gimmick.** Mono type, box drawing and key hints come from tokens too, so they
  remain legible in every preset.

## Charts

Charts use Recharts through the shadcn `chart` primitive. Give every series a token colour
(`hsl(var(--chart-1))` via the chart config) and a text label, so colour is never the only carrier of
meaning — the accessibility sweep checks this.
