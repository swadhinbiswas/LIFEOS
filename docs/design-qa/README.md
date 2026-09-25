# Design QA — LifeOS vs the NexaCRM reference

Spec §13 asks for side-by-side screenshots of each LifeOS screen against its NexaCRM counterpart and
for every meaningful **structural** difference to be fixed. The skin differs on purpose (terminal
tokens, monospace — §4); the **craft** must not (§13).

- Reference: `docs/reference/*.png` (12 screens, studied 2026-09-25).
- Ours: `docs/design-qa/lifeos-*.png`, captured with `node scripts/design-qa.mjs`.
- Reference screenshots are **study only** — no code was copied (ADR-002).

## The reference anatomy (what every screen does)

1. **App frame.** Fixed sidebar ~250 px; a top bar with a page icon + title on the left, a global
   search field, theme toggle, help and avatar on the right; a second-level settings nav on settings.
2. **Sidebar.** Brand block (logo, product, plan) → **labelled sections** (Favorites, Dashboards, CRM,
   Workspace, Views, System) → **nested groups** (Views › Table › Companies/People/…, collapsible) →
   active row is a filled rounded item → **user block** at the bottom (avatar, name, role).
3. **Page header.** Entity icon + name; below it a row: left = current view + **count**
   ("All People · 121"); right = **view switcher** (Table/Kanban/Grid/Calendar), **Filter**, **Sort**,
   **Options**, and a **primary action** (`+ New person`).
4. **Stat cards.** Four rounded cards: small muted label, **large value**, and a circular icon chip.
   (Analytics adds deltas `+12.6%`, badges, and bar/line/donut charts in larger cards.)
5. **Data surfaces.** Tables: checkbox column, header icons + muted uppercase labels, ~56 px rows,
   avatars/logos, **status pills**, coloured due dates, row `…` menu. Kanban: rounded columns with a
   header pill (status + count + `…`) and **rich record cards** (logo, title, url, industry, headcount,
   location, owner avatar, amount). Grid: 5-column card wall. Calendar: month grid with record cards.
6. **Density and depth.** Page background darker than cards; 12 px radii; 16–24 px gaps; hairline
   borders; colour only for status/brand, never decoration.

## Gaps found in our build (and status)

| #   | Gap                                                                | Reference                                                        | Status                                                                                                                              |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sidebar was a flat 26-item list                                    | labelled sections + nested groups + user block                   | **Fixed** — `NAV_SECTIONS`, section labels, brand + user block                                                                      |
| 2   | Header showed a tagline, no location or search                     | page title + global search + icons                               | **Fixed** — page title from nav + search button (Ctrl/Cmd+K)                                                                        |
| 3   | Dashboard opened with a widget-config panel and a KPI _table_      | stat cards first, config behind an affordance                    | **Fixed** — `StatCard` grid (value, delta pill, meter, link); layout panel last                                                     |
| 4   | Lists rendered as plain text rows (notes, habits, goals, finance…) | avatars, pills, preview columns, row menus                       | **Partial** — notes (pills, hover, `EmptyState`) and habits (meter, heatmap) done; goals, finance, learning, portfolio, prep remain |
| 5   | Our table view lacks pills/avatars/menus                           | status pills, icons, row menu                                    | **Open**                                                                                                                            |
| 6   | Kanban columns are hairline boxes; cards are text-only             | rounded columns + rich record cards                              | **Fixed** — rounded columns with a count pill; cards with priority pills, estimate, hover                                           |
| 7   | Dashboard has no charts; KPIs have no delta pills                  | bar/line/donut charts, delta badges                              | **Partial** — delta pills and `AsciiMeter`s are in; no time-series charts (no series data yet)                                      |
| 8   | Screens waste width / overflow the page                            | full-width card grids that scroll internally                     | **Fixed** — `PageHeader` on 27 pages; the board scrolls inside its container; `min-w-0` + `overflow-x-hidden` guard                 |
| 9   | Settings has one flat page                                         | second-level settings nav (Personal/Workspace/Developers/System) | **Open**                                                                                                                            |

Shared primitives introduced: `PageHeader`, `StatCard`, `EmptyState` (`src/components/tui/`).
Re-capture with `node scripts/design-qa.mjs` and update this table per pass.

## Priority for the remaining pass

1. Lists: goals, finance, learning, portfolio, prep → pills, preview columns, `EmptyState`.
2. Table view: status pills, avatars, row menus.
3. Dashboard: time-series charts (focus minutes, habit history) via `Spark`.
4. Settings: second-level nav (Personal / Workspace / Developers / System).
5. Re-capture `docs/design-qa/` after each pass and update this table.

This table is the honest record: the fixes are shipped one screen at a time, and a screen is only
marked fixed when its screenshot has been compared again in both themes.
