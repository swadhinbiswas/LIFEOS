# LifeOS — Phase 0 Research

> Status: **complete** (Phase 0 acceptance: docs exist, claims cite sources, open risks listed).
> Method: 12 reference screenshots measured, live NexaCRM demo + product/CSS fetched, official
> vendor docs fetched at build-planning time (2026-09-23), npm registry versions fetched
> 2026-09-23, GitHub API + profile README + swadhin.cv fetched for seed research.
> Anything not verifiable from a source is labelled **unverified (memory)** inline.

---

## (a) NexaCRM design measurements & screenshot analysis

**Sources (fetched 2026-09-23):** live demo `https://shadcn-nextjs-nexacrm-app-template.vercel.app/`
(prod page renders and is fetchable — contrary to the spec's warning), product page
`https://shadcnstudio.com/templates/admin-dashboard/nexacrm`, its shipped stylesheets
`/_next/static/chunks/18bcmqibumo5~.css` and `/_next/static/chunks/0mbv.dw3~pj-f.css`,
license page `https://shadcnstudio.com/license`, and the 12 PNGs in `docs/reference/`.

### Hard measurements (from the fetched CSS, exact values)

| Token / attribute               | Value                                                                                                                                                                                                                | Evidence                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `--sidebar-width`               | `16rem` (256 px)                                                                                                                                                                                                     | demo HTML `style=` attribute                                                              |
| `--sidebar-width-icon`          | `3rem` (48 px)                                                                                                                                                                                                       | demo HTML                                                                                 |
| `--radius` (default)            | `0.45rem` (7.2 px)                                                                                                                                                                                                   | demo HTML + `nexa1.css`                                                                   |
| `--spacing` (default scale)     | `0.25rem` (4 px)                                                                                                                                                                                                     | `nexa1.css`; scale SM `0.2222rem`, LG `0.26222rem` under `[data-theme-scale]`             |
| Dark `--background`             | `#171717`                                                                                                                                                                                                            | `nexa1.css:.dark`                                                                         |
| Dark `--foreground`             | `#ebebeb`                                                                                                                                                                                                            | `nexa1.css:.dark`                                                                         |
| Dark `--border`                 | `#222`                                                                                                                                                                                                               | `nexa1.css:.dark`                                                                         |
| Light `--background` / `--card` | `#fff`                                                                                                                                                                                                               | `nexa1.css`                                                                               |
| Light `--foreground`            | `#333`                                                                                                                                                                                                               | `nexa1.css`                                                                               |
| Light `--border`                | `#ebebeb`                                                                                                                                                                                                            | `nexa1.css`                                                                               |
| `--primary`                     | light `#18181b`, dark `#e4e4e7` (neutral zinc, **not** blue)                                                                                                                                                         | `nexa1.css` — the blue buttons seen in screenshots come from a preset override at runtime |
| Default font                    | `--font-sans: var(--font-manrope)` (Manrope)                                                                                                                                                                         | demo HTML                                                                                 |
| Fonts shipped as CSS vars       | Geist, Geist Mono, Geist Pixel Square, DM Sans, Figtree, Inter, JetBrains Mono, Lora, Merriweather, Noto Sans, Noto Serif, Nunito Sans, Outfit, Playfair Display, Public Sans, Raleway, Roboto, Roboto Slab, Manrope | `<html>` class list in demo HTML — this is the Font customizer's option set               |
| Sidebar state attrs             | `data-variant="inset"`, `data-state="expanded"`, `data-collapsible`, `data-side="left"`                                                                                                                              | demo HTML (shadcn sidebar contract)                                                       |
| Sidebar width transition        | `transition-[width] duration-200 ease-linear`                                                                                                                                                                        | demo HTML                                                                                 |

### Layout measurements (from the 12 PNGs; ±2 px)

| Area                | Measurement                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header height       | ≈48–50 px; contains sidebar toggle, icon+title breadcrumb, pill search “Type to search…”, palette icon, theme toggle                                                            |
| Sidebar item height | ≈36–38 px, active item = filled rounded rect; section labels above groups (Favorites, Dashboards, CRM, Workspace, Views, System); user chip pinned bottom (Alex Morgan · Admin) |
| Toolbar row         | ≈34 px: left = current view + count (“All Companies · 60”), right = view button (Table/Grid/Calendar/Kanban), Filter, Sort, Options, primary `+ New …` button                   |
| KPI cards           | 4-up, gap ≈24 px, height ≈110 px, radius ≈10–12 px; label 13 px muted top-left, value ≈28–30 px semibold bottom-left, 40 px rounded icon box top-right                          |
| Table               | header row ≈36 px (icon + muted 12–13 px label); data rows ≈44–45 px pitch, 1 px separators; 24 px rounded letter avatars; outlined pill status badges; kebab menu per row      |
| Kanban column       | width ≈264 px, gap ≈10 px; header = status chip + count + drag dots + kebab; card padding ≈16 px, radius ≈8 px, meta rows with icons, footer = avatar+name left / value right   |
| Calendar            | month grid, weekday header ≈28 px, date number top-right, event cards with title (2-line clamp) + meta rows                                                                     |
| Grid view           | 5 columns, card height ≈146 px (pitch ≈188 px), 28 px avatar, name 14 px semibold + title 13 px muted, email/phone rows, company chip bottom                                    |
| Dashboard           | widget grid: KPI row, large bar chart (“Deals closed”), Summary + Pipeline panels, upgrade card, weekly-performance list; delta chips (`+12.6%` / `−12.2%`) bordered rounded-md |

### Information architecture observed

Sidebar groups: **Favorites** (pinned records w/ right-aligned type label) · **Dashboards**
(Analytics, CRM Overview, Sales, Leads) · **CRM** (People, Companies, Opportunities) ·
**Workspace** (Tasks, Notes, Workflows) · **Views** (Table, Kanban, Grid, Calendar — each
expands to entities) · **System** (Settings, Auth, Landing page). Settings uses a second-level
nav (PERSONAL / WORKSPACE / DEVELOPERS / SYSTEM) beside a content card column and a right rail.

### Theme customizer option matrix (product page table, verbatim options)

Preset: Default · Custom — Font: Manrope / Others — Color Mode: Light · Dark · System —
Radius: None · SM · MD · LG — Content Layout: Compact · Full — Scale: SM · MD · LG —
Sidebar Variant: Flush · Inset · Floating — Sidebar Mode: Expanded · Icon · Full.
URL-driven views confirmed: `/people?view=grid`, `/opportunities?view=kanban|calendar`.

### Product / license facts

- Stack advertised: Next.js 16, shadcn/ui, Tailwind v4, TanStack Query, Zustand, nuqs, RHF+Zod,
  React Flow, TanStack Table, React Big Calendar, Lucide, Sonner, ESLint+Prettier, TypeScript.
  Created 2026-08-14, sold $79 via Polar (product page).
- License (`https://shadcnstudio.com/license`, updated 2026-01-13): free components are
  “MIT + Commons Clause” (no sale/redistribution of components alone, no competing products);
  templates are **paid resources** under a Shadcn Studio paid license.
  **LifeOS decision: study measurements only; all code re-implemented from scratch.**

### Where LifeOS deliberately diverges (spec §3 vs measurements above)

Terminal radius default **none** (NexaCRM: 0.45rem), compact rows **28–32 px**
(NexaCRM: 44–45 px), monospace chrome by default (NexaCRM: Manrope sans), TUI primitives
(Panel/StatusLine/Kbd/AsciiMeter/Spark) that NexaCRM does not have, six terminal palettes vs
NexaCRM's neutral zinc. The craft level (density discipline, KPI anatomy, view switcher,
settings IA, 256 px sidebar, header pattern) is what we match.

---

## (b) Competitor teardown

Twelve products, takeaways with sources. Full list of URLs used is at the end of this section.

### 1. Linear (linear.app)

A keyboard-first issue tracker for teams, now also pitching “the product development system for
teams and agents” (https://linear.app/docs/start-guide).

- **Command menu as the universal verb:** Cmd/Ctrl+K runs any action or navigation by name; `/`
  searches issues/projects/docs and accepts raw IDs like `LIN-123`; `?` opens a _searchable_
  shortcuts help screen (https://linear.app/enablement/guide/navigating-linear,
  https://linear.app/changelog/2021-03-25-keyboard-shortcuts-help). → LifeOS: one palette, two
  modes (navigate + act) + fuzzy `?` overlay.
- **Two-key “go to” grammar:** `G` then `I` = Inbox, `G` then `M` = My Issues — mnemonics instead
  of modifier soup (https://linear.app/enablement/guide/navigating-linear).
- **Triage as intake queue:** snooze until time _or_ new activity; rules run in order, **first
  match only** — deterministic and debuggable (https://linear.app/docs/triage).
- **Inbox is keyboard-drivable:** J/K move, Backspace delete, Shift+Backspace delete-all-read,
  H snooze (https://linear.app/docs/inbox).
- **Cycles show a capacity dial** forecast from the previous three cycles' velocity
  (https://linear.app/docs/use-cycles).

### 2. Trello (trello.com)

The canonical drag-and-drop Kanban board wrapped around a personal Inbox + Planner
(https://trello.com/tour).

- **Five automation shapes:** Rules, card buttons, board buttons, calendar commands, due-date
  commands; hard cap 20 actions per automation, documented workaround = second automation on the
  same trigger (https://support.atlassian.com/trello/docs/automation-overview,
  https://support.atlassian.com/trello/docs/create-and-manage-automations). → ship both per-card
  and per-board actions.
- **Passive automation mining:** Butler detects repetitive actions and suggests automations
  (https://trello.com/en/guide/automate-anything).
- **Personal Inbox with `g+i`**, fed by forwarded email / Slack / voice; AI parses raw messages
  for dates/titles, then you drag Inbox → board (https://support.atlassian.com/trello/docs/trello-inbox,
  https://www.atlassian.com/blog/trello/new-trello-is-here). Capture first, structure later.
- **Planner = calendar docked beside the board**, drag cards onto slots
  (https://support.atlassian.com/trello/docs/trello-planner).

### 3. Notion (notion.so)

Block-based docs + databases as a general workspace
(https://www.notion.com/help/category/database-views).

- **Four inline triggers power the editor:** `/` block menu, `@` mentions/dates, `[[` page links,
  `:` emoji; Cmd/Ctrl+K search-jump; peek view `Ctrl+J/K` steps through database pages without
  closing (https://www.notion.com/help/keyboard-shortcuts). → steal peek-pagination for pipeline
  card review.
- **One dataset, many saved views:** each view owns layout, property visibility, filter, sort,
  group/sub-group, with **“Save for everyone” vs personal** toggle per filter
  (https://www.notion.com/help/views-filters-and-sorts).
- **Database templates pre-fill properties _and_ page body**, repeatable daily/weekly/monthly/
  yearly (https://www.notion.com/help/database-templates). → recurring journal + per-application
  CV templates.
- **Nested AND/OR filter groups up to three layers** — advanced logic without a query language
  (same source).

### 4. Todoist (todoist.com)

Mass-market task manager famous for natural-language capture
(https://www.todoist.com/help/todoist/features/introduction-to-tasks-080OAXric).

- **Quick Add grammar with inline parse preview:** `tomorrow at 4 PM`, `{march 30}` deadline,
  `%label`, `p1–p3`, `!14:00` reminder, `#project`, `#Work /Admin`, `+Person`; recognized tokens
  are **highlighted as you type**, and a mis-parse is fixed by **clicking the highlighted word to
  revert it** (https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz).
  This click-to-correct affordance is the single best NL-input pattern to steal.
- **Global Quick Add over any app** + `Q` in-app (same article).
- **Karma:** daily goal 5 / weekly 25, streaks, 8 levels, selectable **days off + Vacation Mode**
  so rest doesn't break streaks (https://www.todoist.com/karma,
  https://www.todoist.com/help/todoist/features/introduction-to-karma-OgWkWy,
  https://www.todoist.com/help/todoist/features/use-the-productivity-view-in-todoist-6S63uAa9).
- **Saved cross-project filters** (https://www.todoist.com/help/todoist/get-started/todoist-glossary-cA60laWMH).

### 5. Things 3 (culturedcode.com/things)

Opinionated Apple to-do app built on a small “when” list set
(https://culturedcode.com/things/support/articles/1059358).

- **Quick Entry with Autofill:** `Ctrl+Space` capture from anywhere, and **every main-app
  keyboard shortcut works inside the capture window** (https://culturedcode.com/things/support/articles/2249437).
  → global capture must support the full field grammar, not just a title.
- **Type Travel:** typing anywhere starts search instantly (https://culturedcode.com/things/features).
- **Tiny scheduling model:** On Date / Anytime / Someday → Today / Upcoming / Anytime / Someday /
  Logbook; hidden lists reachable by typing their name (https://culturedcode.com/things/support/articles/9596775,
  https://culturedcode.com/things/support/articles/2803579).
- **Abbreviation-tolerant NL dates:** `tod`, `2p`, `17d`, `jul9 + 17d`, `3rd wed jul` — “feel free
  to be lazy” (https://culturedcode.com/things/support/articles/9780167).
- **Magic Plus:** one consistent drag handle per row dropping to an Inbox target
  (https://culturedcode.com/things/features).

### 6. Sunsama (sunsama.com)

A daily/weekly _ritual_ planner, deliberately not a project manager
(https://www.sunsama.com/daily-planning).

- **Named five-step ritual:** Process → Plan → Prioritize → Prepare → Publish (to Slack)
  (https://www.sunsama.com/features/daily-planning-and-shutdown). Naming the steps teaches the flow.
- **Pull meetings in first**, then backlog, then email/Slack; “your day is not a project”
  (https://www.sunsama.com/blog/the-official-daily-planning-guide).
- **Estimate duration before scheduling**; over-ambition handled by later deferral, not blocked up
  front; Focus Mode shows actual-vs-planned timer; shutdown captures notes (same + https://www.sunsama.com/).
- **Weekly review with explicit carry-over** and **objectives-vs-tasks** distinction
  (https://www.sunsama.com/features/guided-planning-and-reviews,
  https://help.sunsama.com/docs/usage-guides/weekly-objectives/weekly-planning).
- Tasks dragged from Asana/Linear/Notion stay **two-way synced** (https://www.sunsama.com/a/social).
- (Its oft-quoted “5.5-hour default workload cap” could **not** be verified against a primary
  source and is omitted.)

### 7. Huntr (huntr.co)

Job-search CRM + AI resume builder for individual seekers
(https://help.huntr.co/en/articles/10477521-what-is-huntr).

- **Kanban with inline-editable stages:** rename columns by clicking the title, add by typing
  past the last one, reorder via `⋯ → Move List` (https://help.huntr.co/en/articles/13413245-the-job-board).
- **Stage moves auto-generate activity-log entries** — a free audit trail with zero data entry
  (https://help.huntr.co/en/articles/10042702-activities).
- **Cards carry pipeline metadata:** salary expectations, deadline, original posting link —
  “job listings get taken down fast”, so snapshot the JD at save time (same help set, https://huntr.co/).
- Keyword extraction + match score extended to responsibilities/qualifications, one-click
  LinkedIn→resume import, AI bullet rewriting, Chrome clipper (2 clicks, free to 100 jobs)
  (https://huntr.co/product/linkedin-resume-builder, https://huntr.co/product/job-clipper).

### 8. Teal (tealhq.com)

Free career platform: job tracker + resume builder + JD matching, tied together by an extension
(https://www.tealhq.com/how-it-works).

- **Job Matcher killer UI:** resume and JD side by side, keywords **green = present / red =
  missing**, hovering a keyword scrolls your resume to that spot and offers ignore / `+` to skills
  / AI bullet generation (https://help.tealhq.com/en/articles/12060992-using-the-job-matcher).
  Pattern: _diff view over a score_ — show the gap, not just a number.
- **Threshold-driven export gate:** warns until Analysis ≥60% and Match ≥50%, green/blue/red status
  icons (https://help.tealhq.com/en/articles/9519151-export-your-resume-cover-letter).
- **Cross-feature coupling:** export panel toggle “Move job to applied” flips the tracker card as
  a side effect (same URL). Small automations at moment-of-action beat manual status updates.
- Extension captures salary + structured JD breakdown; **weekly goals** for applications/bookmarks;
  multiple resume versions as first-class objects
  (https://www.tealhq.com/tool/job-search-chrome-extension, https://www.tealhq.com/tools/job-tracker,
  https://www.tealhq.com/tools/resume-builder).

### 9. Simplify (simplify.jobs)

Employer-subsidised job-search suite: browser Copilot for autofill + auto-tracking
(https://simplify.jobs/).

- **Tracking that requires no deliberate act:** applying via Copilot auto-saves the application,
  then prompts confirmation (https://help.simplify.jobs/en/articles/2140179-using-the-job-tracker).
  → every job-pipeline entry auto-creates its activity rows.
- **Three intake paths:** extension save, manual add, **bulk CSV import** — designed for people
  migrating a spreadsheet. CSV import is the real onboarding (same URL).
- **Saved filtered searches, heart-to-favorite, archive ≠ delete, Columns ↔ List toggle**
  (same URL).
- Autofill across Workday/Lever/greenhouse/iCIMS/Taleo/BambooHR; missing keywords shown on the
  application page (https://addons.mozilla.org/en-US/firefox/addon/simplify-jobs).

### 10. Reclaim.ai + Motion

Auto-scheduling calendar layer (Reclaim: https://reclaim.ai/, Motion: https://www.usemotion.com/).

- **Reclaim task form is a scheduling-rules DSL:** duration (min 15 min), due date (default +3
  days), earliest start, **min/max event duration**, working/meeting/personal hours
  (https://help.reclaim.ai/en/articles/5108936-tasks-overview). The _max event duration_ field is
  how it spaces chunks — steal that parameter.
- **Habits express ranges:** “no less than x / no more than y per day”, ideal time, custom
  frequency (2nd Friday monthly), auto Free vs Busy toggling
  (https://help.reclaim.ai/en/articles/4129152-habits-overview-auto-schedule-flexible-time-for-your-routines).
- **Documented deterministic tie-breaks:** higher priority overbooks lower; equal priority →
  Smart Meetings > Habits > Tasks; equal tasks → soonest due date
  (https://help.reclaim.ai/en/articles/6207587-how-reclaim-manages-your-schedule-automatically).
- **Manual overrides on an automated schedule:** Start / Stop (splits) / Lock / Skip / Snooze /
  Log work (https://help.reclaim.ai/en/articles/4453312-managing-tasks-and-task-events-on-your-calendar,
  https://help.reclaim.ai/en/articles/8825115-managing-habit-events-on-your-calendar).
- **Motion makes failure loud:** no duration or no deadline/priority ⇒ cannot schedule;
  unschedulable ⇒ `Could not fit`; ETA indicators as beacons for at-risk deadlines
  (https://www.usemotion.com/help/time-management/auto-scheduling/reference-auto-scheduling,
  https://www.usemotion.com/help/project-management/task/task-scheduling-faq); per-category
  schedules + breaks between tasks
  (https://www.usemotion.com/help/time-management/auto-scheduling/auto-scheduling-how-to-guide).

### 11. Habitica (habitica.com)

Open-source RPG over habits/dailies/to-dos with social accountability (https://www.habitica.com/).

- **Three task types with different punishment contracts:** Habits (±), Dailies (missing costs HP),
  To-Dos (never cost HP) (https://www.habitica.com/static/faq). The dual `+`/`−` habit (“drink
  water vs. soda”) is a reusable model for LifeOS habits.
- **Color _is_ the data:** tasks start yellow, blue as you succeed, red as you fail; redder =
  more damage, bluer = more reward (https://www.habitica.com/static/faq,
  https://habitica.fandom.com/wiki/Damage_to_Player).
- **Cron as explicit day boundary:** midnight or user-set Custom Day Start; missed dailies take
  damage, streaks reset, mana regenerates from completed dailies
  (https://habitica.fandom.com/wiki/Cron). → LifeOS needs a named, configurable “day start”.
- **Streak mercy levers:** 21-day achievement badge, manually restorable streaks, “Pause Damage”
  toggle (https://habitica.fandom.com/wiki/Streaks, https://www.habitica.com/static/faq).
- **Gold buys user-defined real-life rewards**; party quests make a missed daily hurt teammates
  (https://www.habitica.com/static/features).
- _(Cron/streak/damage details come from the community wiki, not official docs — flagged.)_

### 12. Obsidian (obsidian.md)

Local-first Markdown knowledge base with a plugin/theme ecosystem (https://obsidian.md/).

- **Command palette with real fuzzy semantics:** `Ctrl/Cmd+P`, initials work (`scf` → Save current
  file); since v1.8.3 recently-used commands are **pinned to the top but still fuzzy-filtered**,
  shorter commands beating recents once typing starts
  (https://obsidian.md/help/plugins/command-palette). Copy that ranking rule — it solves stale
  recents.
- **Daily notes core plugin** auto-creates `YYYY-MM-DD` files with templates, reachable by ribbon,
  palette or hotkey (https://help.obsidian.md/Plugins/Daily+notes).
- **Graph view:** node size scales with inbound references, local graph with depth slider,
  orphan/tag filters, **time-lapse animation** (https://obsidian.md/help/plugins/graph,
  https://help.obsidian.md/Plugins/Local+graph). A “time-lapse of my task history” is a cheap,
  delightful LifeOS feature.
- **Local-first trust messaging:** open formats, offline, “no one else can read them, not even
  us” (https://obsidian.md/) → ownership + export is LifeOS's positioning too.
- **Everything is a plugin, including core features** (https://obsidian.md/) → document an
  extension surface rather than hard-coding every module.

### Cross-cutting patterns (each supported by ≥1 URL above)

1. Fuzzy command palette as primary UI (Linear Cmd+K, Obsidian Ctrl+P with recents, Notion
   Cmd+K, Reclaim single-key `C`).
2. NL parsing with **live token highlighting + click-to-correct** (Todoist; Things abbreviations;
   Trello Butler reading dates from titles).
3. Global quick-capture inheriting the **full grammar** (Things Quick Entry, Todoist global Quick
   Add, Trello `g+i`).
4. Capture now → structure later: Inbox as staging area (Trello, Things, Linear Triage).
5. One dataset, many **scoped** saved views (Notion personal/shared toggle, Simplify saved
   searches, Todoist cross-project filters).
6. Automations that mine behavior, run on first-match/documented rules (Trello Butler tips +
   20-action cap, Linear first-match triage, Reclaim/Motion published tie-breaks).
7. Pipeline stages as editable columns with auto-logged activity + archive-not-delete (Huntr,
   Simplify).
8. A number **plus** a color-coded gap **plus** a remedy action (Teal diff, Todoist Karma,
   Habitica colors, Linear capacity dial, Motion `Could not fit`).

---

## (c) TUI inspiration study — 10 concrete UI decisions

Five references studied against their own docs. Sources: lazygit
(`docs/Config.md`, `docs/keybindings/Keybindings_en.md`, README), btop (README `#config`,
`src/btop_menu.cpp`), k9s (README, `k9scli.io/topics/skins`), Charm Bubble Tea / Lip Gloss /
Bubbles (`help/help.go`), opencode (`opencode.ai/docs/tui|keybinds|themes`).

### lazygit

- Numbered panel groups, sidebar 1/3 default (`sidePanelWidth: 0.3333`), jump with `1`–`5`,
  `0` returns to main panel; `border: rounded`, `activeBorderColor` green+bold vs
  `inactiveBorderColor` default, `searchingActiveBorderColor` cyan; persistent bottom key-hint
  line (`showBottomLine`, `optionsTextColor` default blue), list panels can show a “5 of 20”
  footer (`showListFooter`); tabs cycled by `tab`/`[`/`]`.
- Keys: `space` stage, `a` hunk, `c` commit, `d` delete, `j/k`, `v` range-select, `/` filter,
  `:` shell, `?` keybindings menu (**a full panel listing every binding grouped by context**),
  `q`/`esc`, `z`/`Z` undo/redo.
- Status colors encode _where a commit lives_: green = on master, yellow = not on master, red =
  unpushed; cherry-pick cyan-on-blue; selected line `selectedLineBgColor` blue; unstaged tinted
  red; commit graph `+`/`_` compact/expand.
- Details: spinner frames `●∙∙ → ∙●∙ → ∙∙●` at 180 ms; `scrollOffMargin: 2` keeps two lines of
  context around the cursor; `expandFocusedSidePanel` grows the focused sidebar panel; undo/redo
  global.

### btop

- Grid of boxes (cpu/mem/net/proc/disks/sensors) with `shown_boxes`, presets `1–9`, flips
  (`proc_left`, `cpu_bottom`); rounded corners on; **help/main/options menus are themselves
  bordered boxes overlaid on the layout**, not separate screens.
- Keys: `F1`/`?`/`h` help, `Esc`/`m` menu, `F2`/`o` options, `q` quit; number keys toggle boxes,
  `p`/`shift+p` presets, `+`/`−` adjust update timer ±100 ms, `f`/`/` filter, `e` tree, `t`/`k`/`s`
  signals; optional `vim_keys`.
- Theme keys give **pause/follow their own background colors**; per-username process colors,
  gradient shading by load; graceful truecolor→256→tty degradation with braille/block/tty graphs.
- Multi-select batch signals; live-editable in-app options (config is a TUI, not a dotfile).

### k9s

- Header (context/namespace/aliases/counters) + main table + **footer menu line of contextual key
  hints**; breadcrumbs (`ctrl-g`); `:` command mode (`:po`, `:deploy ns-x`), `ctrl-a` aliases;
  `headless/logoless/crumbsless/splashless/noIcons` strip chrome; `readOnly: true` disables
  mutating bindings.
- Keys: `?` help dialog; `/` filter, `/!` inverse, `-l` label, `-f` fuzzy, `-` last, `[`/`]`
  history; `space` mark, `ctrl-space` range, `y` YAML, `l` logs, `f` fullscreen, `u` namespace,
  `e` edit, `d` delete **with TAB+ENTER confirm**, `ctrl-k` kill with no confirm; `ctrl-w` wide,
  `ctrl-e` header, `ctrl-g` crumbs, `ctrl-z` faults.
- Skins define **semantic roles**, not widgets: `frame.border.focusColor`,
  `frame.status.{new,modify,error,kill,completed}Color`, `table.cursorColor`,
  `table.header.sorterColor`, `frame.crumbs.activeColor` (https://k9scli.io/topics/skins/);
  `refreshRate` default 2 s, min 1 s.

### Charm Bubble Tea / Lip Gloss / Bubbles

- Elm architecture: Model/Init/Update/View, runtime renders cell-by-cell; layout via
  `JoinHorizontal/JoinVertical/Place`, borders `Normal/Rounded/Thick/Double`, `AdaptiveColors` /
  `HasDarkBackground` for light/dark terminals.
- No built-in modal system — modes are app state; `key.WithKeys/WithHelp` + `key.Matches`
  declarative bindings, each carrying its help text; the `help` bubble consumes a `KeyMap`
  (`ShortHelp()`/`FullHelp()`), disabled bindings self-remove
  (https://github.com/charmbracelet/bubbles/blob/main/help/help.go).
- Help styles keys/descriptions/separators separately with `DefaultStyles(isDark)`; **short help
  is one line split by `•` and truncates with `…` instead of wrapping**; full help joins
  columns and skips empties; bubbles ship spinner/progress/viewport/table/paginator/list.

### opencode TUI

- Transcript + input footer; status bar shows cwd, LSP count, MCP count, version; footer hints
  `[Agent | Model | Provider]` + `[Spinner|Esc] … [Tab] switch agent [Ctrl+P] commands` with
  `hints_visible` toggle; `tui.json` holds `theme/leader_timeout/keybinds/scroll_speed/diff_style/
cursor/mouse/attention`.
- Slash commands in composer (`/help /models /sessions /themes /compact /undo /redo`), `@` file
  fuzzy-ref, `!` shell; **`ctrl+x` leader with 2000 ms timeout** for chords (`ctrl+x n` new,
  `ctrl+x m` models…); `ctrl+p` palette; `tab` cycles agents; user-overridable `keybinds`.
- Themes are JSON with semantic tokens incl. **three border tokens `border`/`borderActive`/
  `borderSubtle`**, dedicated `diff*` and `syntax*` tokens; special value `"none"` inherits the
  terminal; `system` theme derives a gray scale from the terminal background.
- `attention` config = per-event desktop notifications/sounds (question/permission/error/done);
  optional mouse capture (disable restores native selection); `/undo`/`/redo` use git internally.

### The 10 concrete UI decisions for LifeOS

1. **Three-tier border tokens.** Every panel gets `border`, `borderActive`, `borderSubtle`
   (opencode theme schema — https://opencode.ai/docs/themes/); focus is communicated by border
   color alone.
2. **Persistent footer key-hint row in one accent color**, 4–6 context-sensitive shortcuts for the
   focused panel, exactly like lazygit's `showBottomLine` + `optionsTextColor`
   (https://raw.githubusercontent.com/jesseduffield/lazygit/master/docs/Config.md).
3. **Help overlay generated from the keybinding definitions themselves** (`?` screen built from
   the same binding objects the app matches, Bubbles `ShortHelp()/FullHelp()` semantics where
   disabled bindings self-remove — https://github.com/charmbracelet/bubbles/blob/main/help/help.go).
   Help can never drift from behavior.
4. **Truncate short help with `…`, never wrap** (Bubbles `ShortHelpView`, same source).
5. **Named lifecycle color tokens** (`statusNew`, `statusModified`, `statusError`,
   `statusCompleted`, `statusWarning`) instead of ad-hoc colors, following k9s skin roles
   (https://k9scli.io/topics/skins/) — and always paired with a glyph (spec §5: color is never
   the only signal).
6. **Focused panel border brighter + bolder** than inactive (lazygit `activeBorderColor`
   green+bold vs `inactiveBorderColor` default, Config.md source above).
7. **Number keys jump panels; `0` returns to the main panel** (lazygit `jumpToBlock`,
   Keybindings_en.md source above).
8. **Leader key with timeout:** `ctrl+x` leader, 2000 ms window, chords like `ctrl+x n` (new) /
   `ctrl+x m` (models), coexisting with plain keys (opencode `leader_timeout` —
   https://opencode.ai/docs/tui/).
9. **Two lines of scroll-off margin** around the selected row in every list
   (`scrollOffMargin: 2`, lazygit Config.md source above).
10. **Live refresh-rate control + spinner for background work:** pollers expose an interval
    (default ~2 s, min 1 s, `+`/`−` steps à la btop's ±100 ms) and render `●∙∙ → ∙●∙ → ∙∙●` at
    180 ms during updates (k9s `refreshRate` + lazygit spinner + btop `src/btop_menu.cpp`).

**Sources:** https://github.com/jesseduffield/lazygit ·
https://raw.githubusercontent.com/jesseduffield/lazygit/master/docs/Config.md ·
https://raw.githubusercontent.com/jesseduffield/lazygit/master/docs/keybindings/Keybindings_en.md ·
https://github.com/aristocratos/btop · https://github.com/aristocratos/btop/blob/main/src/btop_menu.cpp ·
https://github.com/derailed/k9s · https://k9scli.io/topics/skins/ ·
https://github.com/charmbracelet/bubbletea · https://github.com/charmbracelet/lipgloss ·
https://github.com/charmbracelet/bubbles ·
https://github.com/charmbracelet/bubbles/blob/main/help/help.go ·
https://opencode.ai/docs/tui/ · https://opencode.ai/docs/keybinds/ · https://opencode.ai/docs/themes/

---

## (d) Best-practice notes

### d1. Kanban ordering — fractional indexing

- Each row stores a `TEXT` order key; a move generates a key **between** the two neighbours, so a
  drag = one-row `UPDATE`, and `ORDER BY key` (byte order) reproduces display order
  ([fractional-indexing README](https://www.npmjs.com/package/fractional-indexing),
  [sqliteai mirror](https://github.com/sqliteai/fractional-indexing)).
- `fractional-indexing` **v4.0.0** (rocicorp, CC0, ~1.9M weekly downloads):
  `generateKeyBetween(a, b, digits?, intDigits?)` — `(null,null)`→`"a0"`, append→`"a1"`,
  prepend→`"Zz"`, midpoint(`"a1"`,`"a2"`)→`"a1V"`; `generateNKeysBetween(a,b,n,…)` spaces `n`
  keys evenly and the README recommends it for multi-inserts (“shorter keys”). Default digits =
  `BASE_62`; head alphabet must be even-length; custom alphabets must be single-byte and ascending
  or it throws. **Sorting pitfall: keys are case-sensitive — `localeCompare` yields wrong order;
  use native `<`/`>`** (README + issues #19/#20).
- Canonical articles: Evan Wallace/Figma [Realtime Editing of Ordered Sequences](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/),
  [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/),
  Wallace 2022 [CRDT: Fractional Indexing](https://madebyevan.com/algos/crdt-fractional-indexing/)
  (jitter advice; LWW with peer-id tie-break; arbitrary-precision decimals — 64-bit floats fail
  after ~50 averagings). A Figma “drag and drop” post and a react.dev fractional-indexing article
  do **not** exist — treat as **unverified (memory)**; the React-ecosystem write-up that exists is
  [Liveblocks](https://liveblocks.io/blog/how-crdts-and-sync-engines-keep-realtime-lists-ordered-with-fractional-indexing).
- LexoRank is **Atlassian/Jira's** system (the “Asana/Linear heritage” framing is
  **unverified (memory)**): bucket + LexoDecimal, `LexoDecimal.between(left,right,spaceToRemain)`
  with documented max 1:4 adjacent-gap ratio ([Javadoc](https://docs.atlassian.com/jira-software/9.12.33/com/atlassian/greenhopper/model/lexorank/LexoRank.html));
  public ranks look like `0|vmis7l:hl4` ([SO analysis](https://stackoverflow.com/questions/40718900/jiras-lexorank-algorithm-for-new-stories)).
- **Rebalance thresholds (Atlassian published):** rank ≥128 chars → rebalance within 12 h;
  ≥160 → immediately; ≥254 → Jira stops issuing; 3-bucket ring `0→1→2→0`
  ([Managing LexoRank](https://confluence.atlassian.com/spaces/ADMINJIRASERVER/pages/938847803/Managing+LexoRank)).
  Library mitigations: widen bracket / `genNext()` / rebucket ([intradeus/lexo-rank](https://github.com/intradeus/lexo-rank));
  jitter to avoid identical concurrent keys; **read→compute→write is not atomic** — concurrent
  inserts between the same pair can duplicate keys ⇒ `UNIQUE` constraint + retry
  ([gexorank](https://github.com/lupppig/gexorank)).
- vs integer ranks: integer/gap ranks renumber neighbours or exhaust gaps; fractional keys grow
  unbounded → periodic rebalance; base62 keys sort correctly under SQLite `BINARY` collation and
  need no escaping ([sqliteai](https://github.com/sqliteai/fractional-indexing),
  [write-up](https://sonim1.com/en/blog/fractional-indexing/)).

### d2. Optimistic updates for DnD

Canonical TanStack Query pattern ([Optimistic Updates guide](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)):
`onMutate` → `cancelQueries` → snapshot `getQueryData` → `setQueryData` optimistic → **return the
snapshot** → `onError` rollback → `onSettled` `invalidateQueries`. Lighter alternative: if only
one place renders the result, use `variables` and skip cache surgery (same guide).
Concurrency (TkDodo, TanStack maintainer — [Concurrent Optimistic Updates](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)):
without `cancelQueries`, a focus-refetch can clobber the optimistic write; for overlapping
mutations invalidate only when last: `if (queryClient.isMutating({ mutationKey }) === 1)
invalidateQueries(...)` checked **imperatively in `onSettled`** (not `useIsMutating()` —
stale-closure risk).
Server-side conflicts: `UPDATE … WHERE id=@id AND version=@version`, 0 rows ⇒ conflict
([EF Core concurrency](https://learn.microsoft.com/en-us/ef/core/saving/concurrency) — that page
explicitly covers SQLite's **lack of native rowversion** ⇒ app-managed integer `version`, which
our schema already has; without a token it's plain last-writer-wins, same source). **LifeOS
shape:** mutation carries `version`, server 409s stale writes, client rolls back + refetches +
conflict toast (rollback/toast UX itself = design recommendation, mechanics = documented).
Alternative: [TanStack DB mutations](https://tanstack.com/db/latest/docs/guides/mutations)
(pending→persisting→completed|failed, auto-rollback).

### d3. Drag-and-drop accessibility

dnd-kit ([Accessibility guide](https://github.com/dnd-kit/docs/blob/master/guides/accessibility.md)):
Keyboard sensor enabled **by default** alongside Pointer; `useDraggable` exposes
`role`/`aria-roledescription`/`aria-describedby`; hidden off-screen **screen-reader instructions**
(customizable `screenReaderInstructions`); **live-region announcements** via `announcements`
(`onDragStart/onDragOver/onDragEnd/onDragCancel`), using **positions, not indices** (“position 2
of 5”); English-only defaults (localize); accessibility props grouped under
`accessibility={{ announcements, screenReaderInstructions, container }}`; hidden nodes are **no
longer portalled to body by default** (screen readers may miss them inside dialogs —
[PR #746](https://github.com/clauderic/dnd-kit/pull/746)); activator must be focusable and
rebinding keys requires updating instructions (“third rule of ARIA”: Enter **and** Space) —
[Keyboard sensor docs](https://github.com/dnd-kit/docs/blob/master/api-documentation/sensors/keyboard.md);
replacing the default `sensors` array without re-adding `KeyboardSensor` silently removes
keyboard DnD ([Configuring Sensors](https://dndkit.com/react/guides/sensors)). ⚠️
`aria-grabbed` is deprecated in ARIA 1.1 (https://w3c.github.io/aria/) — don't emit it.
W3C: the **APG has no drag-and-drop pattern at all** ([APG index](https://www.w3.org/WAI/ARIA/apg/patterns/);
the 2016 draft said advice “will be added to a future version”
([WD](https://www.w3.org/TR/2016/WD-wai-aria-practices-1.1-20160317/)); the historical wiki page
requires keyboard-navigable grabbables but was last edited **2007** and its properties are
deprecated ([PF/ARIA/BestPractices/DragDrop](https://www.w3.org/wiki/PF/ARIA/BestPractices/DragDrop)).
**WCAG 2.5.7 Dragging Movements (AA):** every dragging function needs a single-pointer path
([Understanding 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html),
failure [F108](https://www.w3.org/WAI/WCAG22/Techniques/failures/F108)); 2.5.7 does **not** cover
keyboard, so 2.1.1 is separate ([w3c/wcag#2705](https://github.com/w3c/wcag/issues/2705)).
Accepted pattern = **button-based move alternatives**: up/down buttons or move menu
([Massachusetts.gov guidance](https://www.mass.gov/info-details/coding-web-applications-using-advanced-aria-techniques),
[GitHub Primer checklist](https://primer.style/accessibility/tools-and-resources/checklists/mobile-checklist/));
corroborated by react-beautiful-dnd's lifecycle announcements
([screen-reader guide](https://github.com/atlassian/react-beautiful-dnd/blob/master/docs/guides/screen-reader.md)).
**LifeOS combo:** dnd-kit keyboard sensor + position-based announcements + explicit move
up/down buttons (satisfies 2.1.1 and 2.5.7).

### d4. CV / ATS parsing

Vendor-documented failure modes (highest confidence) — Greenhouse
[Unsuccessful resume parse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse):
files **>2.5 MB**; graphics/photos/word art; image uploads instead of .docx/.pdf;
**“complex resumes with tables, headers, and footers”**; **contact info in header/footer/text
box**; **“columned layout”**; no clear sections / inconsistent formats; letter-spaced text;
company names missing Inc./Co./LTD/LLC; truncated titles (`Sr. Account Exec`); partial parses
need manual correction. Corroborating (medium confidence, career-advice tier): Indeed's ATS
checklist — standard headings (Contact Information, Summary, Skills, Experience, Education),
single column without tables/text boxes/graphics, contact in body, `.docx`, `MMM YYYY` dates,
acronyms spelled out, JD keywords repeated 2–3× with singular/plural variants, plain bullets, and
a **plain-text copy-paste test**
([Indeed](https://www.indeed.com/career-advice/resumes-cover-letters/automated-screening-resume));
ATS pipeline parse → fields → index → keyword match → rank ([iCIMS glossary](https://www.icims.com/glossary/applicant-tracking-system-ats/),
[iCIMS parsing](https://www.icims.com/blog/what-is-cv-resume-parsing/),
[Workable](https://resources.workable.com/tutorial/applicant-tracking-systems-atoz)).
⚠️ **No primary ATS-vendor source specifies font families/embedded fonts** — “use Arial 10–12pt”
claims are résumé-tool marketing, **low confidence**; Lever's [parsing doc](https://help.lever.co/hc/en-us/articles/20087345054749-Understanding-Resume-Parsing)
failed to render this session — **unverified (memory)**.
**Honest ATS score:** there is no universal score; Greenhouse states its AI “doesn't score or
rank applications” ([candidate FAQ](https://my.greenhouse.com/blogs/what-really-happens-after-you-apply-for-a-job),
[Talent Matching FAQ](https://support.greenhouse.io/hc/en-us/articles/41131616864283-Talent-Matching-Data-Processing-FAQ));
third-party “match rate ≥80%” numbers are proprietary marketing ([Jobscan](https://www.jobscan.co/blog/greenhouse-ats-what-job-seekers-need-to-know/)).
→ LifeOS ships: **(1) parse-fidelity score** = round-trip PDF/DOCX→text vs JSON Resume source
(section presence, date integrity, contact fields, reading order); **(2) layout-risk checklist**
of booleans (tables/columns/headers/footers/graphics) each linked to a vendor citation;
**(3) keyword coverage vs this JD** explicitly labelled as such — never “ATS score”.
**JSON Resume spec:** MIT, JSON-Schema, version **1.0.0** ([schema](https://jsonresume.org/schema),
[repo](https://github.com/jsonresume/resume-schema), npm `@jsonresume/schema` **1.3.1**): `basics`
(name, label, image, email, phone, url, summary, location, profiles[]), `work[]`, `volunteer[]`,
`education[]`, `awards[]`, `certificates[]`, `publicifications[]`, `skills[]` (name, level,
keywords[]), `languages[]`, `interests[]`, `references[]`, `projects[]`; JSON Resume is also
working on a Job Description schema (same page) — useful for the JD matcher.

### d5. Job-search funnel metrics

Formulas (ours, no external source needed): `app→screen %`, `screen→interview %`,
`interview→offer %`, `app→offer %` (product), `response rate by source`, `time-in-stage`
(median per stage), `applications/week vs goal`, `ghosted` (no reply/state change after threshold T).
Benchmarks with sources:

- **SmartRecruiters “Recruiting Benchmarks 2026”** ([PDF](https://ta.smartrecruiters.com/rs/664-NIC-529/images/Recruiting-Benchmarks%202025-2026.pdf);
  12 months ATS data Sep 2023–Aug 2024, 89M applications, 1.5M jobs, 95 countries): **73
  applicants/role → 3 interviewed → 1 offer** ⇒ ⓓ app→interview ≈ **4.1%**, interview→offer ≈
  **33%**, app→offer ≈ **1.4%** (derived from per-role averages, not cohort rates); median time
  to hire **38 days**, review **6 days**, interview **14 days**; 15% of hires from
  referrals+internal; AI-using companies hire 26% faster.
- **Greenhouse “The Hire Standard”, March 2026** ([PDF](https://cdn.prod.website-files.com/6668a687e71e2722fccb8357/69c6a67c710b821d52b0d5d3_Greenhouse_Benchmark_Report_March2026_NorthAmerica.pdf);
  6,000+ companies, 640M applications / 3 years): Stage-1 progression **7.6%** (−14.8% vs 2022),
  Stage-2 **22.0%** (+4.4%) — exact stage definitions not spelled out in the excerpt read, verify
  before quoting as app→interview; **203 applications per hire** in 2025 (+157.7% vs 2022);
  22.7 interviews/job; 12.3 interview hours/hire. Source shares 2025 — applications: external
  boards 49.9%, company boards 23.8%, social 5.6%, other 3.2%, recruiter-sourced 2.9%; hires:
  company boards 34.4%, external 22.6%, referrals 11.6%, other 10.6%, recruiter 9.7% ⇒ ⓓ relative
  conversion recruiter ≈ **3.3×**, company boards ≈ **1.4×**, external boards ≈ **0.45×**;
  recruiters source ~10% of hires from 3% of applications; job boards = 73.7% of applications
  but <50% of hires (also [landing page](https://www.greenhouse.com/recruiting-benchmarks)).
- **CareerPlug 2025 Recruiting Metrics** (2024 data, 60k+ SMBs, 10M+ applications —
  [page](https://www.careerplug.com/recruiting-metrics-and-kpis/)): click→apply **6%**,
  applicant→interview **3%**, interview→hire **27%**, **180 applicants/hire** (range 57 education
  → 234 automotive); job boards ≈60% of applications. ⚠️ its own prose is internally inconsistent
  (“just 2%”, “26%”) — cite headline numbers only and flag.
- **Ghosting:** 61% ghosted after an interview ([Greenhouse 2024 State of Job Hunting](https://www.greenhouse.com/blog/greenhouse-2024-state-of-job-hunting-report));
  95% of jobs auto-acknowledge, >50% auto-reject, silence usually queue-filtering
  ([my.greenhouse.com](https://my.greenhouse.com/blogs/what-really-happens-after-you-apply-for-a-job));
  CareerPlug Candidate Experience 2024 ([PDF](https://www.careerplug.com/wp-content/uploads/2024/01/2024-Candidate-Experience-Report-1.pdf)):
  **53% candidates ghosted, 44% ghosted employers, 45% expect a reply within 2–3 days**,
  recommends the “24-48-5” rule. (Its per-stage ghosting pie extracted ambiguously from the PDF —
  do not quote stage splits without re-reading the chart.)
- **Suggested thresholds (design heuristic, not benchmark):** no reply **21 days after applying**
  (≫ 6-day review + 14-day interview medians) or **14 days after an interview**; treat “ghosted”
  as a **soft** state because silence ≠ rejection. **Folklore:** “applications/week vs goal” has
  no citable population benchmark — target-driven only; anchor expectations instead on ≈73
  (SmartRecruiters ⓓ) or ≈180 (CareerPlug) applications per offer/hire; circulated “response rate
  2–5%” figures appear only in SEO aggregators — **low confidence/folklore**.

### d6. Natural-language date capture — chrono-node

**v2.10.1**, MIT, ~1.95M weekly downloads, repo [wanasit/chrono](https://github.com/wanasit/chrono)
(5.3k★) ([npm](https://www.npmjs.com/package/chrono-node)). API ([README](https://github.com/wanasit/chrono)):
`chrono.parseDate(text, ref?, options?) → Date | null`, `chrono.parse(...) → ParsedResult[]`;
`ParsedResult = { refDate, index, text, start: ParsedComponents, end?, date() }`;
`ParsedComponents.get/isCertain/date()`. Reference accepts `Date` or
`{ instant?, timezone? }` (offsets or abbreviations); options `forwardDate`, `timezones`.
**Casual vs strict:** default = casual (`'Today'`, `'Friday'` parse); `chrono.strict` only
formal patterns (`'2016-07-01'` ✓, `'Today'` → null). v2 = TS rewrite, **default locale is
international English only**, locales `fi fr it ja nl ru uk vi` + partial
`de es pt sv zh.hans zh.hant`; import `chrono-node/en` for smaller builds.
**Limitations:** timezones are the known weak spot — open issue
[#590](https://github.com/wanasit/chrono/issues/590) catalogs 7 related issues (#385 #403 #532
#546 #552 #564 #582) calling for an IANA tz database; date ranges can fail
([#604](https://github.com/wanasit/chrono/issues/604) `'26 July - 22 August'`); **no recurrence**
in the documented API (RRULE/"every Monday" needs a custom `Parser` or another library — the
absence is from README coverage, labelled accordingly); ambiguous components need your own
Refiner (README). → LifeOS: chrono for capture preview + `isCertain` flags for the inline
highlight, `rrule` for recurrence, store UTC / render in user tz (spec §12).

---

## (e) Library verification table

Versions fetched from the npm registry `dist-tags` on **2026-09-23**; docs URLs fetched the same
day. Pin exact versions at install; re-verify then (a version drift between now and Phase N is
expected — treat this as the snapshot, package.json as the truth).

| #   | Library                                                         | Version (registry latest 2026-09-23) | Docs URL                                                                                                   | Key API we will use                                                                                                                                                                                                      | Risk                                                                                                                                                                        |
| --- | --------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | next                                                            | **16.3.6**                           | https://nextjs.org/docs                                                                                    | App Router, Server Actions, **`proxy.ts` (Next 16 renamed middleware → proxy)**                                                                                                                                          | Medium: recent major; confirm proxy + auth patterns against Next 16 docs at Phase 1 (Better Auth already documents Next 16: https://better-auth.com/docs/integrations/next) |
| 2   | react / react-dom                                               | 19.3.0                               | https://react.dev                                                                                          | Server Components, `use`, Actions                                                                                                                                                                                        | Low                                                                                                                                                                         |
| 3   | typescript                                                      | **7.0.2** (native line)              | https://www.typescriptlang.org/docs                                                                        | strict mode project config                                                                                                                                                                                               | **High: brand-new major.** If eslint/test tooling breaks, fall back to the newest 5.x/6.x that Next 16 supports; record choice in DECISIONS                                 |
| 4   | tailwindcss                                                     | 4.3.3                                | https://tailwindcss.com/docs                                                                               | CSS-first `@theme`, tokens for 6 palettes                                                                                                                                                                                | Low; v4 config differs from v3 (verify at Phase 1)                                                                                                                          |
| 5   | shadcn (CLI)                                                    | 4.21.0                               | https://ui.shadcn.com/docs                                                                                 | `shadcn add` primitives, re-skinned                                                                                                                                                                                      | Low                                                                                                                                                                         |
| 6   | drizzle-orm                                                     | **0.45.3** (`dist-tags.latest`)      | https://orm.drizzle.team/docs/overview · Turso guide https://orm.drizzle.team/docs/connect-turso           | `drizzle({ connection: { url, authToken } })`, `sqliteTable`                                                                                                                                                             | **Medium: docs now promote a 1.0 RC** (`npm i drizzle-orm@rc`, banner “Upgrade to v1.0 RC”). Pin stable 0.45.3 for MVP, revisit RC later → DECISIONS                        |
| 7   | drizzle-kit                                                     | 0.31.11                              | https://orm.drizzle.team/docs/drizzle-kit                                                                  | `generate`/`migrate`/`push`/`studio`                                                                                                                                                                                     | Low                                                                                                                                                                         |
| 8   | @libsql/client                                                  | 0.18.0                               | https://docs.turso.tech/sdk/ts/reference                                                                   | `createClient({ url, authToken })`                                                                                                                                                                                       | Low                                                                                                                                                                         |
| 9   | better-auth                                                     | 1.7.5                                | https://better-auth.com/docs                                                                               | `betterAuth`, `toNextJsHandler`, `auth.api.getSession`, `getSessionCookie` (redirect-only, **not** security)                                                                                                             | Low–Med: v1.7 docs are versioned (https://better-auth.com/docs/llms.txt) — follow the 1.7 index                                                                             |
| 10  | @better-auth/drizzle-adapter                                    | 1.7.5                                | https://better-auth.com/docs/adapters/drizzle                                                              | `drizzleAdapter(db, { provider: "sqlite" })` — **now a separate package**                                                                                                                                                | Low: keep versions in lockstep with better-auth                                                                                                                             |
| 11  | @tanstack/react-query                                           | 5.103.2                              | https://tanstack.com/query/latest/docs                                                                     | `useMutation` optimistic pattern (d2), tag-based invalidation                                                                                                                                                            | Low                                                                                                                                                                         |
| 12  | @tanstack/react-table                                           | 9.2.4                                | https://tanstack.com/table/latest                                                                          | column visibility/sort/filter/selection/pinning/grouping                                                                                                                                                                 | Med: v9 is current; re-read table APIs at Phase 2                                                                                                                           |
| 13  | @tanstack/react-virtual                                         | 3.14.13                              | https://tanstack.com/virtual/latest                                                                        | row virtualization for 500+ cards/tables                                                                                                                                                                                 | Low                                                                                                                                                                         |
| 14  | zustand                                                         | 5.0.15                               | https://zustand.docs.pmnd.rs                                                                               | theme/customizer/shortcut stores                                                                                                                                                                                         | Low                                                                                                                                                                         |
| 15  | nuqs                                                            | 2.10.1                               | https://nuqs.dev                                                                                           | `?view=&filter=` URL state                                                                                                                                                                                               | Low                                                                                                                                                                         |
| 16  | react-hook-form + @hookform/resolvers                           | 7.88.0 / 5.9.1                       | https://react-hook-form.com                                                                                | `useForm`, zodResolver                                                                                                                                                                                                   | Low                                                                                                                                                                         |
| 17  | zod                                                             | 4.6.5                                | https://zod.dev                                                                                            | every boundary schema; OpenAPI source                                                                                                                                                                                    | Med: v4 major — check `zod-openapi` generator compat at Phase 5                                                                                                             |
| 18  | @dnd-kit/core / sortable / utilities                            | 6.3.1 / 10.0.0 / 3.2.2               | https://dndkit.com                                                                                         | `DndContext`, KeyboardSensor, `accessibility.announcements` (d3)                                                                                                                                                         | Low–Med: keep `KeyboardSensor` when customizing sensors (d3)                                                                                                                |
| 19  | fractional-indexing                                             | 4.0.0                                | https://www.npmjs.com/package/fractional-indexing                                                          | `generateKeyBetween`/`generateNKeysBetween` (d1)                                                                                                                                                                         | Low; heed `localeCompare` pitfall                                                                                                                                           |
| 20  | recharts                                                        | 3.10.1                               | https://recharts.org                                                                                       | themed bar/line charts                                                                                                                                                                                                   | Low; spec allows visx fallback                                                                                                                                              |
| 21  | react-big-calendar                                              | 1.20.0                               | https://github.com/jquense/react-big-calendar                                                              | month/week/day/agenda + drag reschedule                                                                                                                                                                                  | Med: styling to tokens; FullCalendar 7.1.0 is the fallback                                                                                                                  |
| 22  | @upstash/redis                                                  | 1.39.0                               | https://upstash.com/docs/redis/overall/getstarted                                                          | cache + idempotency store (24 h keys)                                                                                                                                                                                    | Low                                                                                                                                                                         |
| 23  | @upstash/ratelimit                                              | 2.2.0                                | https://upstash.com/docs/redis/sdks/ratelimit-ts/overview                                                  | `new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(n, "10 s") })` (also fixedWindow/tokenBucket — https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms)                                                     | Med: default **timeout fails open** — configure explicitly and document                                                                                                     |
| 24  | @upstash/qstash                                                 | 2.11.3                               | https://upstash.com/docs/qstash/overall/getstarted                                                         | webhook retries/delays/cron fan-out                                                                                                                                                                                      | Low                                                                                                                                                                         |
| 25  | ai (AI SDK)                                                     | **7.0.112** (v7)                     | https://ai-sdk.dev/docs                                                                                    | `generateText/streamText`, `tool({ description, inputSchema: z, execute })`, **`toolApproval` two-call flow** (`tool-approval-request`/`-response`), `stopWhen: isStepCount(n)`, MCP tools `/docs/ai-sdk-core/mcp-tools` | Med: v7 renamed `needsApproval`→`toolApproval` (deprecated path still works) — follow v7 docs only                                                                          |
| 26  | @modelcontextprotocol/sdk                                       | 1.30.0                               | https://modelcontextprotocol.io                                                                            | Streamable HTTP transport, tool `readOnlyHint`/`destructiveHint`                                                                                                                                                         | Med: spec date moves — pin spec **2026-07-28** + SDK, re-verify at Phase 5 build time                                                                                       |
| 27  | @dodopayments/nextjs                                            | 0.3.9                                | https://docs.dodopayments.com/developer-resources/nextjs-adaptor                                           | checkout route handler, portal route handler, webhook route handler; env `DODO_PAYMENTS_API_KEY/_WEBHOOK_KEY/_RETURN_URL/_ENVIRONMENT`                                                                                   | Med (0.x) + **critical external blocker — see (g)**                                                                                                                         |
| 28  | resend                                                          | 6.28.1                               | https://resend.com/docs                                                                                    | verification/reset/digest mail                                                                                                                                                                                           | Low; SMTP adapter fallback (spec §7 table)                                                                                                                                  |
| 29  | @react-pdf/renderer                                             | 4.9.0                                | https://react-pdf.org                                                                                      | ATS-safe PDF export                                                                                                                                                                                                      | Med: must prove selectable-text/ATS round-trip vs Playwright HTML→PDF (spec §7 table: pick after testing Vercel limits)                                                     |
| 30  | next-intl                                                       | 4.14.6                               | https://next-intl.dev                                                                                      | `en` + scaffolded `bn`                                                                                                                                                                                                   | Low                                                                                                                                                                         |
| 31  | lucide-react / sonner                                           | 1.47.0 / 2.0.8                       | https://lucide.dev · https://sonner.emilkowal.ski                                                          | icons; toasts with undo                                                                                                                                                                                                  | Low                                                                                                                                                                         |
| 32  | ulid                                                            | 3.0.2                                | https://github.com/ulid/spec                                                                               | text IDs (spec allows ulid or cuid2; `@paralleldrive/cuid2` 3.3.0 checked as alternative)                                                                                                                                | Low; choose one → DECISIONS                                                                                                                                                 |
| 33  | @jsonresume/schema                                              | 1.3.1                                | https://jsonresume.org/schema                                                                              | CV data shape validation                                                                                                                                                                                                 | Low                                                                                                                                                                         |
| 34  | pino (+pino-pretty)                                             | 10.3.1 / 13.1.3                      | https://github.com/pinojs/pino                                                                             | structured logs                                                                                                                                                                                                          | Low                                                                                                                                                                         |
| 35  | vitest / @vitest/coverage                                       | 5.0.1                                | https://vitest.dev                                                                                         | unit + ≥80% services coverage                                                                                                                                                                                            | Med: v5 major — check config migration at Phase 1                                                                                                                           |
| 36  | @playwright/test                                                | 1.63.0                               | https://playwright.dev                                                                                     | e2e + axe runs + PDF experiments                                                                                                                                                                                         | Low                                                                                                                                                                         |
| 37  | @axe-core/playwright / axe-core                                 | 4.13.0                               | https://github.com/dequelabs/axe-core                                                                      | WCAG 2.2 AA gate every route × theme                                                                                                                                                                                     | Low                                                                                                                                                                         |
| 38  | msw                                                             | 2.15.0                               | https://mswjs.io                                                                                           | API/MCP integration mocking                                                                                                                                                                                              | Low                                                                                                                                                                         |
| 39  | eslint / eslint-config-next / prettier / eslint-config-prettier | 10.11.0 / 16.3.6 / 3.9.9 / 10.1.8    | https://eslint.org · https://nextjs.org/docs/app/api-reference/config/eslint                               | lint + format gate                                                                                                                                                                                                       | Med: eslint 10 major — validate with next config at Phase 1                                                                                                                 |
| 40  | husky / lint-staged / @commitlint/cli                           | 9.1.7 / 17.5.1 / 21.2.3              | https://github.com/typicode/husky · https://github.com/lint-staged/lint-staged · https://commitlint.js.org | pre-commit format/lint, commit-msg conventional check                                                                                                                                                                    | Low                                                                                                                                                                         |
| 41  | @testing-library/react / jest-dom / @total-typescript/shoehorn  | 16.3.3 / 7.0.1 / 0.1.2               | https://testing-library.com · https://www.totaltypescript.com                                              | component tests; `shoehorn` for partial fixtures                                                                                                                                                                         | Low                                                                                                                                                                         |
| 42  | clsx / tailwind-merge / class-variance-authority                | 2.1.1 / 3.7.0 / 0.7.1                | https://github.com/lukeed/clsx · https://github.com/dcastil/tailwind-merge · https://cva.style             | `cn()` helper, variant styling                                                                                                                                                                                           | Low                                                                                                                                                                         |
| 43  | rrule                                                           | 2.8.1                                | https://rrule.js.org                                                                                       | recurring tasks (`RRULE` column)                                                                                                                                                                                         | Low; chrono has no recurrence (d6)                                                                                                                                          |
| 44  | @types/node / @types/react / @types/react-dom                   | 26.6.2 / 19.3.0 / 19.3.0             | —                                                                                                          | strict TS support                                                                                                                                                                                                        | Low                                                                                                                                                                         |

---

## (f) GitHub seed research (spec §12)

**Raw data:** `docs/research/github-swadhinbiswas.json` (combined: `fetched_at`, `sources`,
`user`, `orgs`, `repos` ×93, `profile_readme`); split originals `github-user.json`,
`github-repos.json`, `github-orgs.json`, `profile-readme.md` also kept. Fetched 2026-09-23 from
`https://api.github.com/users/swadhinbiswas`, `…/repos?per_page=100&sort=updated`, `…/orgs`,
`…/repos/swadhinbiswas/swadhinbiswas/readme`, plus `https://www.swadhin.cv/`.

### Re-verified facts vs. the spec's snapshot (§12 said “re-verify”)

| Claim in prompt.md                                                                                              | Verified 2026-09-23                                                                                                         | Verdict                                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| ~84 public repositories                                                                                         | **93** (`public_repos: 93`; 76 non-fork, 660 stars non-fork, 104 followers, `hireable: true`, `company: "@TheOpenCodeHub"`) | Updated                                                                                                   |
| Headline “MLOps & Data Engineer \| Python · Spark · Kubernetes \| Pipeline Automation \| Open to EU Relocation” | matches `bio` verbatim                                                                                                      | Confirmed                                                                                                 |
| X `@swadh1n`                                                                                                    | `twitter_username: "swadh1n"`; profile README + swadhin.cv both link **`x.com/swadhin_sh`**                                 | **Conflict** — README/site say `swadhin_sh`; use README/site for public links, keep API value in raw data |
| LinkedIn `in/swadh1n`                                                                                           | swadhin.cv links **`linkedin.com/in/swadhinbiswas`**                                                                        | **Conflict** — prefer site                                                                                |
| Orgs: Roast-Lang, nanoLMs, StreamBerryLabs                                                                      | **nanoLMs, StreamBerryLabs, AetherRavyn** (Roast-Lang absent)                                                               | Updated                                                                                                   |
| Pinned: opengrammar, FAANG-Playbook, OpencodeHub                                                                | all three present                                                                                                           | Confirmed                                                                                                 |
| fetchx (Rust) and “ls-f” (Rust)                                                                                 | `fetchx` present; repo is named **`lsf`** (description “ls-f is a Linux terminal ls…”)                                      | Name correction                                                                                           |
| Sites swadhin.cv + swadhin.my.id, ORCID, Hugging Face                                                           | `blog: https://swadhin.cv` confirmed; others not present in the API payload fetched (unverified this run)                   | Partial                                                                                                   |
| User email private                                                                                              | `user.email: null` — nothing to leak; profile README links `swadhinbiswas.dev@gmail.com`                                    | Email **excluded from seed** per §12                                                                      |

### Top public repos (non-fork, by stars; from the raw JSON)

| Repo           | ★   | Language   | Pushed     | Description (verbatim)                                                                                                     |
| -------------- | --- | ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| veet           | 151 | Go         | 2026-08-19 | Universal Linux Application Uninstaller & Deep-Clean Residual Purger (topics: appimage, bubbletea, cli, debian, disk-spa…) |
| opengrammar    | 124 | TypeScript | 2026-09-21 | A Opensource and self hosted alternative of Grammarly                                                                      |
| Mervelas       | 51  | TypeScript | 2026-04-03 | An independent, high-performance AI coding CLI built with Bun and driven by free resources                                 |
| FAANG-Playbook | 40  | Astro      | 2026-08-31 | Complete guide to landing tech jobs at FAANG & 200+ companies with 1,400+ LeetCode problems                                |
| swadhinbiswas  | 27  | Astro      | 2026-09-23 | README repository                                                                                                          |
| AIBOT          | 25  | HTML       | 2025-07-12 | Telegram chatbot                                                                                                           |
| OpencodeHub    | 16  | TypeScript | 2026-08-28 | self-hosted Git platform (SSH, Actions-compatible pipelines, AI reviews); homepage docs.opencodehub.space                  |
| linuxy         | 16  | HTML       | 2026-09-23 | One click AppImage Runner                                                                                                  |
| lsf            | 15  | Rust       | 2026-08-22 | terminal ls with file-type icons                                                                                           |
| de-omarchy     | 14  | QML        | 2026-08-27 | Beautiful, Modern & Opinionated Linux for non omarchy Users                                                                |
| ChanDeskPro    | 14  | TypeScript | 2026-01-17 | privacy-focused 4chan desktop client                                                                                       |
| TheProfessor   | 13  | Python     | 2024-02-10 | Agentic AI system against CopyCats                                                                                         |

Corpus stats: languages Python 24 · TypeScript 13 · (none) 7 · HTML 6 · Astro 4 · Go 4 · Rust 4 ·
C 3 · QML 2 · Shell 2; 25 repos have topics; **43 repos pushed in 2026**; homepages include
recordly.dev, airtraffic.eu.cc, terrasentinel-dashboard.pages.dev, opengrammer.eu.cc,
eurostream-api.onrender.com.

### Profile README (“At a glance”, verbatim facts usable for seed)

Roles: Data Engineer / Backend Engineer / Analytics Engineer (mid-level). Experience: 3+ years
full-time since 2023 + freelance from 2021. Focus: streaming pipelines, lakehouses, GDPR erasure,
CI quality gates. Location: Dhaka, Bangladesh; ready to relocate to Germany, the Netherlands, or
Austria, or work remote across the EU. **Visa: needs sponsorship · Availability: immediate.**
Education: B.Sc. Computer Science and Engineering, Daffodil International University,
**April 2022 – July 2026**. Core stack: Python, Go, Rust, Kafka, Spark, Databricks, dbt, DuckDB,
PostgreSQL, Docker, AWS, Azure, GCP. Public links: swadhin.cv, blog.swadhin.cv, www.swadhin.cv/cv,
cal.com/swadhinbiswas, LinkedIn, X.

### swadhin.cv (public site, fetched 2026-09-23) — CV structure source

Headline: “Backend engineer and co-founder… open to mid-level data and backend roles”;
“Available internationally · Asia/Dhaka”; “Co-founded Boringrats (acquired). Currently building
OpencodeHub, OpenDPP, RAVEN, and JUSTAPI.” Public stats: Users reached 1M+ (on Boringrats before
acquisition), Acquisition 2025 (Boringrats, November 2025), Production work 3+ yrs. Current focus:
data engineering, MLOps, AI systems, open source; seeking relocation to Germany/Netherlands/Austria.
Experience (publicly displayed): Founder · OpencodeHub (May 2026–present); Co-Founder & Lead
Data/Backend Engineer · BoringRats (Jan 2023–Nov 2025); Full Stack Developer · Freelance
(Jan 2021–Dec 2022). Projects page shows EU Air Traffic (ADS-B→Kafka→Bronze/Silver→dbt/DuckDB,
★4), TerraSentinel, EuroStream, OpenCodeHub, JustAPI, Aurora… Sections: About, Experience,
Skills, Projects, Achievements, Research, Writing, Bookshelf, Explore. Job-search FAQ states work
authorization / notice-period style info publicly.

**Per §12 these are seed-eligible** (publicly stated on fetched site): basics, projects, skills,
work history, education. **Excluded:** any email address; anything not publicly displayed
(awards/achievements detail pages were not fetched — leave empty or fetch at seed time, labelled
“add yours” until then). All fictional pipeline companies remain tagged `sample`.

### Seed content plan (derived, no inventions)

JSON Resume `basics` (name “Swadhin Biswas”, label from README roles, location Dhaka BD, profile
links above) · `projects[]` from the top-repo table (verbatim descriptions + languages) ·
`skills[]` grouped by the README stack and repo language/topic distribution (Python, Go, Rust,
TypeScript, Kafka, Spark, dbt, DuckDB, Kubernetes/MLOps, data pipelines) · `work[]` + `education[]`
exactly as displayed on swadhin.cv/README · career board reflecting “Open to EU Relocation” +
visa-sponsorship-required fields + target roles (Data Engineer, Backend Engineer, MLOps/Platform)
· job pipeline 8–12 `sample`-tagged fictional companies · interview-prep board structured on
FAANG-Playbook's public categories (link, don't copy) · projects board Idea→Spec→Build→Ship with
real repos + `sample` tasks · habits (LeetCode, reading, workout, writing) + 30 days of
`generated` logs · templates Student/Freelancer/Blank · everything under `is_demo=true`,
one-click removable (§12).

---

## (g) Vendor & spec findings

### g1. Dodo Payments (docs.dodopayments.com — index `llms.txt` fetched 2026-09-23)

- **Model:** all-in-one merchant of record for SaaS/AI/digital products — payments, billing,
  distribution; one-time, subscription, credit/usage-based billing
  (https://docs.dodopayments.com/introduction).
- **Official Next.js adapter exists:** `@dodopayments/nextjs` **0.3.9** with three route-handler
  examples — checkout (GET static / POST dynamic / POST session), customer portal, webhooks — and
  env contract `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_RETURN_URL`,
  `DODO_PAYMENTS_ENVIRONMENT="test_mode"|"live_mode"`
  (https://docs.dodopayments.com/developer-resources/nextjs-adaptor). This is exactly our
  §11 `POST /api/billing/checkout` + `GET /api/billing/portal` + `POST /api/webhooks/dodo`.
- **Webhooks:** follow the **Standard Webhooks** spec, **HMAC SHA256** signature verification,
  automatic retries with exponential backoff, per-event subscription filtering; dashboard has
  Endpoints / Event catalog / Logs / Activity (https://docs.dodopayments.com/developer-resources/webhooks).
  Idempotency is still ours: dedupe by event id in `billing_events` (§11).
- **Checkout sessions:** hosted, customizable, dynamic pricing/PWYW supported
  (https://docs.dodopayments.com/developer-resources/checkout-session,
  https://docs.dodopayments.com/developer-resources/dynamic-pricing-checkout).
- **Subscriptions:** dedicated integration guide + upgrade/downgrade with proration + payment
  failure handling (https://docs.dodopayments.com/developer-resources/subscription-integration-guide,
  https://docs.dodopayments.com/developer-resources/subscription-upgrade-downgrade,
  https://docs.dodopayments.com/developer-resources/handle-payment-failures).
- **Payment methods:** cards global (min $0.50, subscriptions yes), Apple/Google Pay (excl. IN),
  UPI/Rupay (IN), iDEAL/NL, EPS/AT, Klarna/Afterpay, Pix/BR, stablecoins, wallets by region; all
  pre-configured, auto-shown by location/currency/device; per-checkout
  `allowed_payment_method_types` must always include `credit`+`debit` fallbacks or checkout can
  fail (https://docs.dodopayments.com/features/payment-methods).
- **⚠️ Regional eligibility — the Bangladesh question §11 asked about** (fetched
  https://docs.dodopayments.com/miscellaneous/accepted-countries-and-territories):
  eligibility is decided by **the country that issued the government ID you verify with**, not
  company registration; the accepted list (177 countries/territories) **does not include
  Bangladesh** for new merchants; Bangladesh appears only in the **grandfather clause**
  (“Merchants who were receiving services in a country before it was added to the prohibited list
  … unless subject to active sanctions… **Bangladesh**, Egypt, Equatorial Guinea, Eritrea, … are
  grandfathered”), and “merchants domiciled in any other country on the prohibited list … are **not
  eligible to onboard or continue transacting**.” Payouts only in listed countries. Their own
  advice: contact `support@dodopayments.com` **before** integrating.
  → **Consequence:** a new Dodo merchant account for an operator in Bangladesh is **not
  guaranteed and likely unavailable**. Because §11 ships everything behind
  `BILLING_ENABLED=false` anyway, Phase 7 builds the plumbing but the **go-live decision is
  blocked on this**; contingency options recorded in DECISIONS.md (contact Dodo support to confirm
  grandfathering; or evaluate an alternative MoR — e.g. Polar, which sells the NexaCRM template
  itself — or an entity in a supported country). Nothing in the UI changes while billing is off.
- Test mode: `test_mode` keys, dedicated testing docs (https://docs.dodopayments.com/miscellaneous/testing-process);
  we add a webhook replay script (§11).

### g2. Turso (docs.turso.tech — index fetched 2026-09-23)

- Product lines: **Turso Cloud** (managed libSQL, branching, analytics, backups),
  Turso Database (embedded engine), AgentFS, Sync (https://docs.turso.tech/introduction).
  LifeOS uses **Turso Cloud** (spec §13: PITR/branching documented).
- **Drizzle integration is official:** `drizzle-orm` + `@libsql/client`, scripts
  `db:generate`/`db:migrate`/`db:studio` (https://docs.turso.tech/sdk/ts/orm/drizzle); the Drizzle
  side documents `drizzle({ connection: { url, authToken } })` and all `@libsql/client` module
  variants incl. `/web` for Next.js (https://orm.drizzle.team/docs/connect-turso). Note: that page
  currently suggests `drizzle-orm@rc` (v1.0 RC) — we pin stable (see (e)#6).
- **FTS5 is preloaded and built-in** on Turso (https://docs.turso.tech/features/sqlite-extensions)
  — satisfies `search_index` (spec §7). The same page lists JSON1, R*Tree, sqlean crypto/fuzzy/math.
- **Vector search is native** — “Vector Similarity Search is built into Turso and libSQL Server
  as a native feature” with an `F32_BLOB` type and vector functions
  (https://docs.turso.tech/features/ai-and-embeddings, https://docs.turso.tech/guides/vector-search,
  https://docs.turso.tech/sql-reference/functions/vector) — spec §12's “verify vector support” is
  now answered: yes, no extension needed (semantic search still optional/post-MVP per cut-list).
- **PITR:** backups at every COMMIT; free plan = last **24 h**, Developer/Scaler/Pro = 10/30/90
  days; restore creates a **new** database then you switch the connection string; cannot
  resurrect a deleted DB (5-day recovery window on paid)
  (https://docs.turso.tech/features/point-in-time-recovery).
- **Branching:** `turso db create X --from-db Y` (or Platform API), branches are fully separate
  (manual merge via migration tool), need their own/group token, count toward plan quota, and
  there's a CI/CD example creating a branch per PR
  (https://docs.turso.tech/features/branching).
- Also available if needed later: embedded replicas w/ push-pull sync
  (https://docs.turso.tech/features/embedded-replicas/introduction), CDC, concurrent-writes docs.

### g3. Upstash (upstash.com/llms.txt + docs fetched 2026-09-23)

- Positioning: serverless, pay-per-use, no idle costs; products Redis, Vector, Search, QStash,
  Workflow, Box, Blob (https://upstash.com/llms.txt). LifeOS uses **Redis + Ratelimit + QStash**
  (Workflow is available for the scheduled briefs if Cron proves insufficient).
- Redis quickstart (https://upstash.com/docs/redis/overall/getstarted); `@upstash/redis` 1.39.0
  over REST — right fit for serverless/edge.
- **Ratelimit** (`@upstash/ratelimit` 2.2.0): HTTP-based, built for serverless/edge/Next.js;
  features: caching of blocked requests, **timeout that allows the request by default if Redis
  doesn't answer** (fail-open — we must decide explicitly), analytics/dashboard, traffic
  protection deny-lists, custom rates, multi-region, **multiple limits per instance**, dynamic
  limits (https://upstash.com/docs/redis/sdks/ratelimit-ts/overview). Algorithms:
  `fixedWindow` (cheap; boundary bursts leak), `slidingWindow` (approximation, solves boundary
  stampede, more expensive — **spec §9.1 asks for sliding window**), `tokenBucket`
  (smooths bursts; not for MultiRegion) with exact usage examples
  (https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms). Reset-time caveat: sliding window
  reset = start of next window, not first request (same page).
- **QStash** (`@upstash/qstash` 2.11.3): HTTP delivery with retries, delays, cron schedules,
  fan-out (https://upstash.com/docs/qstash/overall/getstarted) — backs webhook retry/backoff
  (§9.3) and the morning-brief/Friday-review schedules (§8); pricing visible at
  https://upstash.com/pricing/qstash (free tier, then $1/100K).
- Docs quality note: `https://upstash.com/ask?q=…` returns cited doc snippets — useful during
  build.

### g4. MCP specification (modelcontextprotocol.io fetched 2026-09-23)

- **Current spec = 2026-07-28** (`/specification/latest` resolves there; schema
  `schema/2026-07-28/schema.ts`); versioned docs also exist for 2025-11-25, 2025-06-18,
  2025-03-26 — pin our implementation + docs links to **2026-07-28** and re-verify at Phase 5.
- Transport spec (https://modelcontextprotocol.io/specification/2026-07-28/basic/transports):
  JSON-RPC 2.0, UTF-8; bindings are stdio (newline-delimited, client-launched subprocess) and
  **Streamable HTTP** — “each message is an HTTP POST to a single MCP endpoint; replies arrive as
  a JSON object or a request-scoped SSE stream”; custom transports allowed; **direction rule:
  servers do not initiate JSON-RPC requests and clients do not send JSON-RPC responses**;
  protocol metadata travels in `_meta.io.modelcontextprotocol/*`.
- Authorization: dedicated tutorial — “Understanding Authorization in MCP” = **OAuth 2.1** for
  remote servers (https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/authorization);
  matches §9.2 sequencing (API-key Bearer first, OAuth after).
- Tooling: build-server/build-client guides, client best practices, **MCP Inspector**
  (https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector) — use it in Phase 5 tests.
- SDK: `@modelcontextprotocol/sdk` **1.30.0** (registry, 2026-09-23). We expose
  `/api/mcp` (Streamable HTTP), tools with `readOnlyHint`/`destructiveHint`, resources
  `lifeos://…`, prompts `plan_my_day` etc. (§9.2), token-efficient responses, same service layer
  - rate limits + audit (`actor = mcp:<client>`).

---

## Open risks and mitigations

| #   | Risk                                                                                                                                      | Sev  | Mitigation                                                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | **Dodo unavailable to a Bangladesh-domiciled operator** (new accounts not eligible; only grandfathered) — blocks paid launch              | High | Everything ships behind `BILLING_ENABLED=false` (§11) so no user-facing impact; Phase 7 builds plumbing + test-mode flow; before go-live: (a) email Dodo support citing the grandfather clause, (b) evaluate alternate MoR (Polar/Lemon Squeezy-class) or entity in supported country; decision recorded in DECISIONS.md; public /pricing stays “Free” |
| R2  | TypeScript **7.0.2** brand-new major may break eslint/test/Next tooling                                                                   | High | Pin at Phase 1; run full gate immediately; fallback = newest supported 5.x/6.x; ADR before scaffolding                                                                                                                                                                                                                                                 |
| R3  | Drizzle stable (0.45.3) vs promoted **1.0 RC** divergence                                                                                 | Med  | Pin stable for MVP; no RC APIs in our code; scheduled re-evaluation ADR after Phase 4                                                                                                                                                                                                                                                                  |
| R4  | TanStack Table **v9** / React Big Calendar API drift from remembered usage                                                                | Med  | Re-read official docs at Phase 2 start (table + calendar spikes), not from memory                                                                                                                                                                                                                                                                      |
| R5  | MCP **spec drift** (2026-07-28 today; SDK features may lag/lead)                                                                          | Med  | Pin spec date + SDK 1.30.0; re-verify transports/auth at Phase 5 build time; Inspector in CI                                                                                                                                                                                                                                                           |
| R6  | AI SDK v7 approval flow (`toolApproval` two-call) semantics subtle (deprecated `needsApproval`, provider-executed tools bypass approvals) | Med  | Follow v7 docs only; destructive tools never auto-approve (§8); fixture evals + malicious-JD injection tests                                                                                                                                                                                                                                           |
| R7  | chrono-node **timezone weakness** (issue #590) mis-parses capture                                                                         | Med  | Inline parse preview + click-to-correct (Todoist pattern, (b)#4), `isCertain` highlighting, store UTC / render user tz, manual override always possible                                                                                                                                                                                                |
| R8  | Fractional key duplication under concurrent inserts (read→compute→write not atomic)                                                       | Med  | `UNIQUE(board_id, column_id, position)` + retry with fresh neighbours; rebalance job at ≥128 chars (Atlassian thresholds)                                                                                                                                                                                                                              |
| R9  | Kanban/table performance at 500+ rows                                                                                                     | Med  | Fractional keys + TanStack Virtual + optimistic single-row updates; perf benchmark is a Phase 2 acceptance item                                                                                                                                                                                                                                        |
| R10 | PDF export not ATS-parseable (selectable text/fonts)                                                                                      | Med  | Early Phase 3 spike comparing @react-pdf/renderer vs Playwright HTML→PDF on Vercel limits; round-trip parse-fidelity test (d4) as the gate                                                                                                                                                                                                             |
| R11 | “ATS score” claims could mislead users                                                                                                    | Low  | Ship parse-fidelity + layout-risk checklist + JD keyword coverage, all labelled honestly (d4); never a magic 0–100 “ATS score”                                                                                                                                                                                                                         |
| R12 | axe AA failures across 6 themes × all routes                                                                                              | Med  | axe in Playwright per route per theme from Phase 1 (spec §13); keyboard-only walkthrough documented                                                                                                                                                                                                                                                    |
| R13 | Upstash ratelimit **fail-open timeout** default weakens abuse controls                                                                    | Med  | Configure timeout/analytics explicitly; document behavior in docs/SECURITY; auth endpoints additionally use Better Auth rate limits (https://better-auth.com/docs/concepts/rate-limit)                                                                                                                                                                 |
| R14 | Seed research staleness / GitHub API rate limits (unauthenticated 60 req/h)                                                               | Low  | Raw JSON cached with `fetched_at`; seed reads the file, not live API; refresh is a manual command                                                                                                                                                                                                                                                      |
| R15 | Seed facts drift from prompt.md's snapshot (84 repos, Roast-Lang, `ls-f`, X handle conflict)                                              | Low  | Fetched data wins; discrepancies table in (f); conflicts (X/LinkedIn) resolved toward the profile README/site at seed time                                                                                                                                                                                                                             |
| R16 | NexaCRM **commercial license** — copying source would infringe                                                                            | High | Measurements + ideas only (this doc); all LifeOS code original; no NexaCRM source in repo; license URL cited in DECISIONS                                                                                                                                                                                                                              |
| R17 | Email/PDF/webhook external services with real keys                                                                                        | Med  | `.env.example` only, secrets never committed, test-mode fixtures, signature verification tests (Dodo HMAC, webhook HMAC-SHA256)                                                                                                                                                                                                                        |
| R18 | `@dodopayments/nextjs` 0.x churn                                                                                                          | Med  | Adapter is thin — keep business logic in our service layer so an SDK swap costs one file                                                                                                                                                                                                                                                               |
| R19 | Prompt-injection via user data / pasted JDs reaching AI tools                                                                             | High | §8 model: delimiters, untrusted-content framing, approval step before any write, malicious-JD fixtures in evals                                                                                                                                                                                                                                        |
| R20 | Tenant isolation bugs across 6 surfaces (UI/REST/MCP/AI/webhooks/export)                                                                  | High | Two-user isolation test suite as a named deliverable (§10), runs in CI from Phase 5                                                                                                                                                                                                                                                                    |

---

_Phase 0 acceptance checklist:_ docs exist (`RESEARCH.md` §a–g, `ERD.md`, `DECISIONS.md`,
`MVP-SCOPE.md`, raw seed JSON) · claims cite a URL or a measurement (unverified items labelled) ·
open risks + mitigations listed above.
