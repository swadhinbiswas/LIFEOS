0. ROLE AND MISSION

You are a principal full-stack engineer, product designer and technical researcher working as one person. Your job is to design and build LifeOS: a free, open, AI-connected personal operating system as a SaaS web app that lets one person plan and track their work, career (jobs, CV, skills), daily tasks, habits, notes, finances and personal life in one place, with custom Kanban boards for anything.

Working name: LifeOS (keep it in a single config constant, APP_NAME, so it can be renamed in one place).

Success looks like this:

A new user signs up, picks a template ("Job seeker", "Student", "Freelancer", "Engineer", "Blank"), and within 60 seconds has a useful dashboard, a Kanban board and a first task, with no manual setup.
The UI has the layout quality of the NexaCRM reference (section 3) but wears a terminal / TUI skin (section 4): dark by default, monospace, box-drawing borders, keyboard-first, command palette.
Every piece of user data is reachable through a REST API, an MCP server and webhooks (section 9), so any tool or AI agent can read and push data.
An AI copilot is built in and can act on the user's data through the same tool layer (section 8).
The app is completely free today, but billing plumbing with Dodo Payments is already in place behind feature flags so paid plans can be switched on later without a rewrite (section 11).
1. OPERATING RULES (READ TWICE)
Research before code. Complete Phase 0 (section 14) first and write docs/RESEARCH.md. Do not start scaffolding until it exists.
Verify, do not recall. Library APIs change quickly. For every dependency (Next.js, shadcn/ui, Tailwind v4, Drizzle, Turso/libSQL, Upstash, Better Auth, Dodo Payments, the MCP SDK, Vercel AI SDK, dnd-kit), open the official docs at build time and follow the current API. Pin exact versions in package.json. If docs and your memory disagree, the docs win.
No fabricated data. Never invent facts about a real person. Seed data (section 12) must come from public sources you actually fetched; everything else is clearly labelled sample data.
No placeholders in shipped UI. No "Lorem ipsum", no dead buttons, no TODO screens. If a feature is out of scope for a phase, hide it entirely rather than showing a stub.
Everything must run. After every phase: pnpm typecheck && pnpm lint && pnpm test && pnpm build must pass, and you must actually start the app and exercise the new feature. Report what you ran and what you saw.
Small, reviewable commits with conventional-commit messages. One feature per commit. Keep a docs/DECISIONS.md log (ADR style, a few lines each) for every non-obvious choice.
Ask only when blocked. If something is ambiguous, choose the most user-friendly option, record it in DECISIONS.md, and continue. Do not stop to ask about things covered in this document.
Security is not optional. Section 10 is a hard requirement, not a nice-to-have.
Never commit secrets. Provide .env.example with every variable documented. Validate env with Zod at boot (src/env.ts) and fail fast with a readable message.
Respect the reference's license. NexaCRM is a commercial template. Study its layout, information architecture and interaction patterns and re-implement them from scratch in your own code. Do not copy its source, assets, illustrations or copy text.
2. PRODUCT VISION AND PRINCIPLES

One-line pitch: Your whole life, as a keyboard-driven terminal dashboard that an AI can help run.

Who it is for

Persona	Main jobs to be done
Job seeker / early-career engineer	Track applications through a pipeline, keep multiple CV versions, prep interviews, follow up on time
Working professional	Daily tasks, projects on Kanban, weekly review, focus sessions, career growth log
Student / self-learner	Courses, reading list, study habits, deadlines
Freelancer / builder	Clients, projects, invoices-lite, time tracking, portfolio
Anyone	Habits, journal, goals, simple budget, health basics

Principles

Fast beats fancy. Every interaction under 100 ms perceived (optimistic updates). Cold dashboard render under 1.5 s on a mid-range phone on 4G.
Keyboard-first, mouse-friendly, touch-usable. Everything reachable from the command palette (Ctrl/Cmd+K) and single-key shortcuts. Mobile gets a proper responsive layout, not a shrunk desktop.
One core, many lenses. Data lives once; Table, Kanban, Calendar, Grid and Timeline are views over it (exactly like NexaCRM's ?view= switcher).
Opinionated defaults, total flexibility. Templates give instant value; custom boards, fields and views cover everything else.
Your data is yours. Full export (JSON, CSV, Markdown) at any time. Delete account deletes everything.
AI is a colleague, not a gimmick. It reads and writes through audited tools, asks before destructive actions, and is always optional.
Calm. No notification spam, no streak guilt. Helpful nudges only, all configurable.
3. REFERENCE DESIGN ANALYSIS: NEXACRM

Reference: https://shadcn-nextjs-nexacrm-app-template.vercel.app/ (product page: https://shadcnstudio.com/templates/admin-dashboard/nexacrm).

The live demo blocks automated fetching, so if you cannot open it, use the attached screenshots plus the documented structure below. If you can open it in a browser tool, inspect it thoroughly first (layout metrics, spacing, table density, kanban card anatomy, sidebar behaviour, dialogs, empty states, dark mode) and record measurements in docs/RESEARCH.md.

3.1 What NexaCRM is

A Next.js 16 CRM admin template on shadcn/ui and Tailwind CSS v4 with strict TypeScript. Its stack: TanStack Query (server state), Zustand (client state), Nuqs (URL search params), React Hook Form + Zod, TanStack Table, React Big Calendar, React Flow, Lucide icons, Sonner toasts.

3.2 Pages it has (and what each teaches us)
NexaCRM page	Pattern to copy	LifeOS equivalent
/dashboards/analytics (plus CRM overview, Sales, Leads dashboards)	KPI stat cards on top, charts grid, recent-activity lists	/dashboard (Today, Overview, Career, Productivity variants)
/companies, /companies/:id	Filterable table + rich detail page with tabs	/career/companies, company detail with jobs, contacts, notes
/people (?view=grid)	Table ⇄ Grid view switch	/career/contacts (network)
/opportunities (?view=kanban / ?view=calendar)	One dataset, Table / Kanban / Calendar views via URL param	/career/jobs (the job pipeline) and every custom board
/tasks	Task table with filters, sorting, CSV export	/tasks (Inbox, Today, Upcoming, Done)
Notes	Notes attached to records	/notes and per-item notes
/workflows, /workflow-runs/:id	React Flow canvas, run history	/automations (v1.1: rules like "job moved to Interview → create prep task")
/settings, /settings/data-model	Profile settings plus a custom data model editor	/settings, /settings/data-model (custom fields and board schemas)
Auth: sign in/up, forgot/reset password, verify email, accept invitation	Complete auth flows	Same, restyled
Landing page	Public marketing page	Public landing with TUI hero
3.3 Layout anatomy to reproduce
App shell: collapsible left sidebar plus top header plus scrollable content. Sidebar groups (Dashboards, Workspace, CRM, System) with icons, active state, collapse to icon rail, and a user menu at the bottom. Sidebar variants: flush, inset, floating. Sidebar modes: expanded, icon, full.
Header: breadcrumbs, global search / command palette trigger, theme toggle, notifications, user avatar menu.
Page header pattern: title, subtitle, primary action button on the right, view switcher (Table | Kanban | Grid | Calendar) and filter bar underneath.
Data views: TanStack Table with column visibility, sorting, multi-filter, row selection, bulk actions, pagination, CSV export.
Kanban: column headers with counts, cards with title, tags, avatar, due date, value/priority; drag between columns.
Detail pages: header card plus tabs (Overview, Activity, Notes, Files) plus a right rail of properties.
Theme customizer (live, no rebuild): preset, font, color mode (light/dark/system), radius (none/sm/md/lg), content layout (compact/full), scale (sm/md/lg), sidebar variant, sidebar mode. Reproduce all of these and persist them per user.
Quality details to match: consistent 4/8 px spacing scale, subtle borders instead of heavy shadows, skeleton loaders on every async surface, empty states with a clear next action, toasts for every mutation, responsive down to 360 px.
4. TUI DESIGN SYSTEM ("TERMINAL SKIN ON A MODERN SHELL")

Goal: the structure and polish of NexaCRM, the soul of a terminal (lazygit, btop, k9s, Charm/Bubble Tea apps, the opencode TUI). It must feel like a premium terminal app that happens to run in the browser. It must not look like a joke "hacker" theme.

4.1 Visual language
Typography: monospace everywhere for chrome, labels, numbers and tables. Default JetBrains Mono; alternates selectable in settings: Geist Mono, Fira Code, IBM Plex Mono. Prose-heavy areas (journal, notes editor, CV preview) may switch to a readable proportional font (Inter) via a per-area setting. Load fonts with next/font, with font-display: swap and ligatures toggle.
Borders: 1 px solid hairlines. Panels can render a box-drawing frame with an inline title, e.g. ┌─ TODAY ───────────┐, built with CSS (pseudo-elements, border plus a title chip) and not by literally printing characters, so it stays crisp and accessible. Provide a <Panel title="…" hint="…"> component used by all cards.
Radius: default none (sharp, terminal-like); selectable sm | md | lg via the customizer.
Density: compact by default (row height 28–32 px in tables, 8 px card padding), with comfortable option (matches NexaCRM "scale").
Status line: a persistent bottom bar like vim/tmux: current mode (NORMAL, INSERT, COMMAND), current view path, sync state (● synced / ◌ saving / ○ offline), active focus timer, and hints (? help  : command  / search).
Cursor and focus: visible block-style focus ring on the active row/card (2 px accent outline plus subtle inverse background), never removed for keyboard users.
Progress and charts: ASCII/Unicode-styled meters (▰▰▰▰▱▱ 66%, █▇▆▅, braille sparklines) for compact widgets; Recharts (or visx) for full charts, styled with the palette, thin strokes, no gradients, monospace tick labels.
Iconography: Lucide for actions; small Unicode glyphs for status (● ○ ◐ ✓ ✗ ▸ ⚑). Keep a single icon size grid (14/16/20).
Motion: minimal. 120–160 ms ease-out for panels and drawers, a blinking caret only inside inputs and the command palette. Respect prefers-reduced-motion (disable all non-essential motion).
Empty states: a small ASCII illustration plus one sentence plus one primary action, e.g. no tasks today ▸ press  n  to add one.
4.2 Color themes (implemented as CSS variables mapped to the shadcn token names)

Define semantic tokens once (--background --foreground --card --popover --primary --secondary --muted --accent --destructive --border --input --ring plus --success --warning --info and --chart-1…5), then ship these presets. Use these exact base colors, then derive hover/active/muted via color-mix or oklch adjustments and verify WCAG AA contrast (4.5:1 body text, 3:1 large text and UI borders) for every token pair in every theme, with an automated contrast test.

Preset	Background	Surface/Card	Border	Foreground	Muted fg	Primary	Success	Warning	Danger	Info/Accent
Midnight (default, Tokyo Night-inspired)	
#1a1b26	
#16161e	
#292e42	
#c0caf5	
#565f89	
#7aa2f7	
#9ece6a	
#e0af68	
#f7768e	
#7dcfff / 
#bb9af7
Mocha (Catppuccin Mocha-inspired)	
#1e1e2e	
#181825	
#313244	
#cdd6f4	
#6c7086	
#89b4fa	
#a6e3a1	
#f9e2af	
#f38ba8	
#94e2d5 / 
#cba6f7
Gruvbox (dark)	
#282828	
#1d2021	
#3c3836	
#ebdbb2	
#928374	
#83a598	
#b8bb26	
#fabd2f	
#fb4934	
#8ec07c / 
#d3869b
Phosphor (green monochrome)	
#0b0f0b	
#080b08	
#1b2a1b	
#b6f0b6	
#4f7a4f	
#39ff14	
#39ff14	
#e6db74	
#ff5555	
#5fd7af
Amber (retro amber)	
#120d05	
#0d0903	
#2b2110	
#ffcf7a	
#8a6a2f	
#ffb000	
#a5d66b	
#ffb000	
#ff6b4a	
#ffd98a
Paper (light, for daytime)	
#faf7f0	
#ffffff	
#e2dccd	
#2b2a27	
#8a857a	
#2f5fb3	
#3d7a3a	
#9a6a12	
#b3362f	
#1b7f8a

Also support system mode (maps to Midnight / Paper) and let users define one custom accent color that regenerates primary/ring/chart tokens. Provide the theme JSON in src/config/themes.ts so new presets are one object.

4.3 Keyboard model (the TUI feel)
Global: Ctrl/Cmd+K command palette; / focus search; ? shortcut cheat-sheet; g then a letter to go somewhere (g d dashboard, g t tasks, g b boards, g j jobs, g c CV, g h habits, g n notes, g s settings); n new item in the current context; Esc close/back; t toggle theme; [ toggle sidebar.
Lists/tables/boards: j/k or arrows move focus; h/l move between kanban columns; Enter open; x select; e edit; d due date; p priority; m move to (opens column picker); Shift+J/K reorder the focused card; Space complete/toggle; # add tag; Del delete (with undo toast, never a blocking confirm for reversible actions).
Views: 1 2 3 4 5 switch Table / Kanban / Grid / Calendar / Timeline.
Command palette is a first-class feature: fuzzy search across all entities (tasks, cards, jobs, notes, contacts, pages), actions ("Create task…", "Move card to…", "Start focus 25:00", "Log habit…", "Export data"), navigation, theme switching, and "Ask AI…" at the bottom. Support a quick-capture grammar: buy milk tomorrow 5pm #home !2 creates a task with a parsed due date, tag and priority (use a well-tested date parser such as chrono-node).
Shortcuts are user-remappable in settings and disabled automatically while typing in inputs. Show contextual key hints in the status line.
Vim-style modal editing is optional (toggle in settings), off by default.
4.4 Accessibility (must not regress because of the TUI look)

Semantic HTML, real <button>/<table> roles, visible focus, full screen-reader labels, aria-live for toasts and drag-drop announcements, WCAG 2.2 AA, color is never the only signal (pair with glyphs/text), 44 px minimum touch targets on mobile, support 200% zoom.

5. INFORMATION ARCHITECTURE AND ROUTES (Next.js 16 App Router)
(marketing)/            /  /pricing  /docs  /changelog  /privacy  /terms
(auth)/                 /sign-in /sign-up /forgot-password /reset-password /verify-email /accept-invite
(app)/                  # authenticated shell (sidebar + header + status line)
  dashboard/            today | overview | career | productivity   (dashboard variants, like NexaCRM)
  inbox/                quick capture triage
  tasks/                ?view=table|kanban|calendar  &filter=…
  boards/               list of boards
  boards/[boardId]/     ?view=kanban|table|calendar|timeline
  career/
    jobs/               ?view=kanban|table|calendar     (the job pipeline)
    jobs/[id]/
    companies/  companies/[id]/
    contacts/   ?view=table|grid
    cv/                 resume library, versions, builder, ATS check
    cv/[id]/edit  cv/[id]/preview
    skills/             skill matrix and evidence
    achievements/       "brag doc"
    interview-prep/     question bank, STAR stories, mock sessions
    portfolio/          projects (importable from GitHub)
  habits/               daily check-ins, streaks, heatmap
  goals/                OKRs / goals with key results
  notes/                markdown notes and journal (daily note)
  calendar/             unified calendar (tasks, jobs, habits, events)
  focus/                pomodoro / deep-work timer, sessions log
  finance/              accounts-lite, expenses, budgets, subscriptions
  health/               sleep, workout, water, mood (simple logs)
  learning/             courses, books, reading list
  reviews/              weekly/monthly review wizard
  analytics/            cross-module insights
  automations/          (v1.1) rules and run history
  ai/                   full-page copilot chat (also a slide-over anywhere)
  settings/
    profile | appearance (theme customizer) | shortcuts | data-model |
    integrations (API keys, MCP, webhooks, GitHub, calendar) |
    ai (provider keys, model, privacy) | notifications | data (export/import/delete) | billing
api/
  v1/…                  REST (section 9)
  mcp/                  MCP server (section 9)
  webhooks/dodo/        billing webhooks (section 11)
  ai/…                  copilot streaming endpoints

Use route groups, parallel/intercepting routes for detail drawers (open a card in a right-side sheet, deep-linkable), nuqs for view/filter/sort state in the URL, and TanStack Query for server state with optimistic mutations.

6. FEATURE SPECIFICATIONS

Build features to this level of detail. "Best in the world" here means: fast, keyboard-complete, forgiving (undo everywhere), and flexible without being confusing.

6.1 Kanban engine (shared by Tasks, Jobs, Custom Boards)

Build one board component and reuse it everywhere.

Drag and drop: @dnd-kit (verify current package names) with pointer, touch and keyboard sensors and screen-reader announcements. Drag cards between and within columns, drag columns to reorder, drag onto a column header to move. Auto-scroll near edges. Smooth drop animation. Works on touch devices.
Ordering: store a fractional index / LexoRank-style string per card (position TEXT) so a move updates one row, not the whole column. Include rebalance logic and tests.
Optimistic updates: move instantly, sync in the background, roll back with a toast and retry on failure. Handle concurrent edits with a version integer (last-writer-wins on different fields, conflict toast on same field).
Columns: custom names, colors, emoji/glyph, WIP limits (soft warning when exceeded), collapse column, "done" flag (completing sets completed_at), auto-archive after N days, column-level quick add (+ Add card inline, Enter to add another).
Cards: title, description (markdown), labels, priority (P0–P3), assignee (self for now, schema ready for teams), due date and time, start date, estimate, checklist/subtasks with progress meter, attachments (link, image), comments/activity log, custom fields, linked items (task ↔ job ↔ note ↔ contact), recurrence, reminders, cover color. Card face shows only what the board's "card fields" setting selects.
Swimlanes and grouping: group by column (default), priority, label, due bucket, or any select-type custom field. Filter bar with saved filters; quick filter chips (Due today, Overdue, P0–P1, No date, Stale > 14d).
Bulk actions: multi-select (x, shift-click, lasso), then move, label, set date, archive, delete.
Views over the same data: Kanban, Table (TanStack Table with column resize/reorder/pin, inline cell editing, grouping, aggregation row), Calendar (React Big Calendar or FullCalendar: month/week/day/agenda, drag to reschedule), Timeline/Gantt-lite (start→due bars), Grid (gallery). Saved views per board, shareable by URL.
Board templates (one-click): Daily Kanban (Backlog / Today / Doing / Done), Weekly Planner, Job Pipeline, Study Plan, Content Calendar, Bug Tracker, Project (Idea → Spec → Build → Ship), Reading List, Trip Planner, Blank.
Undo/redo stack (Ctrl+Z) for the last 50 board actions, plus soft delete with a 30-day Trash.
Performance: virtualize long columns (@tanstack/react-virtual), render 1,000+ cards smoothly, paginate server-side.
Import/export: CSV in/out, JSON in/out, Trello and Notion-CSV import (best effort, documented).
6.2 Tasks and daily planning
Inbox → triage to Today / Upcoming / Someday / a board. Natural-language capture (section 4.3). Recurring tasks (RRULE via rrule), snooze, reminders, subtasks, time estimates.
Today view: a "plan my day" panel: top 3 priorities, time-blocked schedule against the calendar, workload meter vs available hours, carry-over of unfinished tasks with one key (c).
Daily brief (also available via API/MCP/AI): overdue, due today, meetings, habits to log, one suggested focus block.
Weekly review wizard (/reviews): guided steps (clear inbox → review boards → review goals → wins & lessons → plan next week), saves to a review note, pre-filled by AI on request.
6.3 Career tracker (jobs, CV, growth): a flagship module

Job pipeline (/career/jobs):

Default stages: Wishlist → Applied → Screening → Interview → Technical → Onsite/Final → Offer → Accepted, plus terminal Rejected and Withdrawn (both configurable and reorderable). Uses the shared Kanban engine, so all of 6.1 applies.
Job fields: title, company (linked record), location, work mode (remote/hybrid/onsite), visa/relocation status (important for international seekers), salary range and currency, source (LinkedIn, referral, company site, email…), URL, posting date, deadline, application date, resume version used, cover letter, contacts, status history with timestamps, priority, excitement rating (1–5), notes, tags, fit score.
Auto-reminders: follow-up N days after applying, before interviews, after interviews (thank-you note), on offer deadlines.
Interview log: per-round records (date, format, interviewers, questions asked, how it went, follow-ups), plus prep checklist and STAR stories linked to the job.
Offer comparison: side-by-side table (base, bonus, equity, benefits, relocation, growth, commute/remote, visa support) with weighted scoring the user can tune, and currency conversion.
Pipeline analytics: funnel (Applied → Screening → Interview → Offer), conversion rates per stage, time-in-stage, response rate by source and by resume version, applications per week vs goal, "ghosted" detection (no update > N days).
Company records with website, size, industry, notes, contacts, all jobs at that company, and research checklist (tech stack, culture, Glassdoor-style notes typed by the user).
Job clipper (v1.1): browser extension or bookmarklet plus POST /api/v1/ingest/job to save a posting from any job site into Wishlist, and AI extraction of fields from a pasted URL/text (with the user's approval before saving).

CV / resume (/career/cv):

A structured resume model (JSON Resume-compatible: basics, work, education, projects, skills, awards, publications, languages, certificates, links) so one source of truth can render many versions.
Versions/variants: duplicate a base CV into targeted versions ("MLOps", "Backend", "EU relocation") and track which version went to which job.
Live split-screen editor: form on the left, paginated A4/Letter preview on the right. Multiple ATS-safe templates (single column, no tables/images for parsing-critical templates). Section drag-reorder, per-section visibility toggles, page-fit indicator.
Export: PDF (server-side render, selectable text, correct fonts), DOCX, Markdown, JSON Resume. Public share link (optional, revocable, unlisted) and a hosted personal page.
AI assist (approval-gated): rewrite bullets with strong action verbs and metrics, tailor a CV to a pasted job description, keyword-gap analysis, cover-letter draft, ATS checklist score. Always show a diff and let the user accept per change. Never invent employers, dates or achievements; the AI may only reword and reorganize what the user supplied and must flag anything it wants the user to verify.
Import: from JSON Resume, from PDF/DOCX (best-effort parsing, review screen), and from GitHub (projects and languages).

Skills, achievements, portfolio, interview prep:

Skills matrix (skill, level, evidence links, last used, target level) that feeds CV skill sections and gap analysis against saved job descriptions.
Achievements ("brag doc"): dated entries with impact metrics, tagged by skill and project; one-click "add to CV".
Portfolio: projects with links, stack, screenshots, and GitHub sync (stars, languages).
Interview prep: question bank (behavioural, system design, coding), STAR story builder, spaced-repetition review for technical topics, mock-interview mode with the AI (text first, voice later), coding-problem tracker (problem, pattern, difficulty, status, revisit date).
6.4 Habits and goals
Habits: daily/weekly/custom schedules (RRULE), binary or numeric (glasses of water, minutes read), streaks with "never miss twice" grace logic and freeze days, GitHub-style yearly heatmap, per-habit stats, reminders. Streak UI must be gentle and never shame.
Goals/OKRs: objective → key results (numeric, %, or task-linked) with progress computed automatically from linked tasks/habits; quarterly cycles; a check-in prompt every week.
6.5 Notes and journal
Markdown-first editor (TipTap or CodeMirror 6; choose after research) with slash commands, backlinks [[wiki-links]], tags, templates, daily note (g n then t for today), mood and energy quick-log, full-text search (SQLite FTS5 in Turso), pinned notes, attachments as links. Optional at-rest encryption for private journal entries (client-side key, clearly explained trade-offs: encrypted entries are not AI-searchable unless the user opts in per entry).
6.6 Finance-lite, health-lite, learning
Finance: manual accounts, income/expense transactions, categories, monthly budgets with progress meters, subscriptions tracker with renewal reminders, CSV import, multi-currency (BDT, USD, EUR at minimum) with cached exchange rates. Clear disclaimer: not financial advice, and no bank connections in v1.
Health: simple logs for sleep, workouts, water, mood, weight; weekly trends. No medical claims.
Learning: courses (progress, deadlines), books (status, notes, highlights), articles queue, spaced-repetition notes.
6.7 Focus and time
Pomodoro / custom timer with task linking, auto-logged sessions, daily/weekly focus totals, ambient status-line timer that persists across pages, optional browser notification and sound. Manual time entries. Reports by board, tag, and project.
6.8 Dashboards (NexaCRM-style, four variants)

Each is a responsive grid of <Panel> widgets. Widgets are configurable: show/hide, reorder (drag), resize (S/M/L), saved per user.

Today: greeting and date, top-3 priorities, schedule/time blocks, due & overdue, habits checklist with streak meters, focus timer, quick capture, AI daily brief.
Overview: KPI stat cards (tasks done this week, focus hours, habit consistency %, active goals, open applications, budget remaining) each with delta vs previous period and a braille sparkline; activity heatmap; boards summary; upcoming (7 days).
Career: funnel chart, applications/week vs goal, stage distribution, next interviews, follow-ups due, resume-version performance, skills gap radar.
Productivity: completed tasks trend, cycle time, focus by day/hour heatmap, backlog age histogram, weekly review streak.

Every KPI has a definition tooltip and links to the filtered list behind it. All charts have an accessible table alternative.

6.9 Global features

Global search (FTS5 + optional semantic search with embeddings stored in Turso's vector support; verify current vector support in docs before relying on it), notifications center (in-app, email, web push; per-type controls and quiet hours), activity feed and audit trail per item, tags and linking everywhere, trash/restore, PWA (installable, offline read cache, offline quick-capture queue that syncs), i18n-ready from day one (next-intl; ship en, scaffold bn (Bangla) with a working example page), timezone-correct dates (store UTC, render in user tz, week start configurable), keyboard cheat-sheet, onboarding checklist, demo mode, and data export/import.

7. ARCHITECTURE AND STACK
7.1 Stack (verify current versions and docs for each before use)
Concern	Choice	Notes
Framework	Next.js 16 (App Router), React 19, TypeScript strict	Server Components by default; Server Actions for forms; Route Handlers for API
UI	shadcn/ui + Tailwind CSS v4 + Lucide	Copy components into src/components/ui, then re-skin via tokens (section 4). Run the shadcn CLI, do not hand-write primitives
Client state	Zustand	UI state only (sidebar, palette, theme prefs before sync)
Server state	TanStack Query	Optimistic mutations, background refetch, persisted cache for offline
URL state	nuqs	View, filters, sort, selected item
Forms	React Hook Form + Zod	One Zod schema shared by client, server actions, REST, MCP and AI tools
Tables	TanStack Table (+ TanStack Virtual)	
DnD	dnd-kit	
Calendar	React Big Calendar or FullCalendar	Choose after research
Charts	Recharts (or visx)	Themed to tokens
Database	Turso (libSQL/SQLite)	Use Drizzle ORM + drizzle-kit migrations; embedded replicas or plain remote per docs; FTS5 for search
Cache / rate limit / queues	Upstash Redis (@upstash/redis, @upstash/ratelimit) and optionally QStash for scheduled jobs and reminders	Caching, rate limiting, idempotency keys, ephemeral locks, presence, AI usage counters. Never the source of truth
Auth	Better Auth (verify it supports Drizzle + libSQL and the plugins you need: email/password, magic link, OAuth (GitHub, Google), API keys, organizations later). If it does not fit after checking docs, use Auth.js v5 and record why	Sessions in DB, secondary storage in Upstash for speed
AI	Vercel AI SDK (provider-agnostic: Anthropic, OpenAI, Google, OpenRouter, local via Ollama-compatible endpoint), tool calling, streaming, structured output	Section 8
MCP	Official TypeScript MCP SDK (@modelcontextprotocol/sdk) or mcp-handler for Next.js; Streamable HTTP transport	Section 9
Payments	Dodo Payments (SDK + Next.js adapter + webhooks)	Section 11
Email	Resend (or SMTP adapter) with React Email templates	Verification, reset, reminders, digests
Files	Uploadthing or S3-compatible (R2) presigned uploads	Only when needed (avatars, attachments); links-only in v1 is acceptable
PDF	Server-side HTML→PDF (Playwright/Chromium via a serverless-compatible package, or @react-pdf/renderer), pick after testing on Vercel limits	Text must remain selectable/ATS-parsable
Testing	Vitest (unit), Playwright (e2e, a11y with axe), MSW	
Tooling	pnpm, ESLint + Prettier, Husky + lint-staged, commitlint, GitHub Actions CI	
Observability	Structured logs (pino), Sentry (optional, env-gated), request IDs, /api/health	
Deploy	Vercel (primary). Provide a Dockerfile and docs for self-hosting	Cron via Vercel Cron or QStash
7.2 Folder structure (feature-first, like NexaCRM's clean structure)
src/
  app/                    # routes only (thin)
  features/
    boards/  tasks/  career/  cv/  habits/  goals/  notes/  finance/
    health/  learning/  focus/  dashboard/  reviews/  automations/  ai/  billing/  settings/
      components/  hooks/  queries.ts  actions.ts  schema.ts  service.ts  types.ts
  server/
    db/ (schema, migrations, client)   redis/   auth/   services/ (domain logic, framework-free)
    api/ (REST handlers, OpenAPI)   mcp/ (tools, resources, prompts)   ai/   jobs/   webhooks/
  components/ui/          # shadcn primitives (re-skinned)
  components/tui/         # Panel, StatusLine, KeyHint, AsciiMeter, Spark, CommandPalette, Kbd
  config/                 # app.ts (APP_NAME…), themes.ts, plans.ts, shortcuts.ts, nav.ts
  lib/                    # utils, dates, fractional-index, rrule, nlp-capture
  env.ts

Single service layer rule: all business logic lives in server/services/*. Server Actions, REST handlers, MCP tools and AI tools are thin adapters that call the same service functions with the same Zod schemas. This guarantees that the UI, API, MCP and AI can never drift apart, and it means one place to enforce authorization, plan limits, audit logging and validation.

7.3 Data model (Drizzle, SQLite/libSQL). Refine, then document in docs/ERD.md

Conventions: text IDs (ulid or cuid2), created_at/updated_at as integer ms UTC, soft delete via deleted_at, every user-owned table has user_id (and workspace_id reserved for future teams) with an index, and every query filters by the authenticated user.

Core tables (minimum):

Identity: users, sessions, accounts (OAuth), verifications, api_keys (hashed, prefix, scopes, last_used_at, expires_at, revoked_at), workspaces, workspace_members (future), user_settings (theme JSON, shortcuts JSON, locale, tz, week_start, ai prefs), audit_log.
Boards: boards (name, template, view config JSON, card_fields JSON, archived), board_columns (name, color, glyph, position, wip_limit, is_done), cards (board_id, column_id, position TEXT, title, description md, priority, due_at, start_at, estimate_min, completed_at, archived_at, recurrence RRULE, kind enum: task|job|generic, meta JSON, version), card_labels, labels, checklists + checklist_items, card_links (polymorphic link between any two entities), comments, attachments, custom_fields (definition per board) + custom_field_values.
Career: companies, contacts, job_applications (card_id FK, company_id, stage_history JSON, salary_min/max/currency, work_mode, visa_status, source, url, resume_id, cover_letter, excitement, fit_score), interviews, offers, resumes (title, base_id, template, data JSON in JSON Resume shape, ats_score, share_slug, share_enabled), resume_versions (snapshots), skills, achievements, projects, star_stories, question_bank, coding_problems.
Habits/goals: habits, habit_logs (habit_id, date, value), goals, key_results, goal_links.
Notes: notes (md, kind: note|daily|journal, encrypted flag), note_links (backlinks), tags, taggings, FTS5 virtual table search_index.
Other: accounts_fin, transactions, budgets, subscriptions_tracked, health_logs, courses, books, focus_sessions, time_entries, reviews, notifications, reminders, saved_views, automations, automation_runs, webhooks_out + webhook_deliveries, ai_conversations + ai_messages, ai_usage.
Billing: plans (config-driven, see section 11), subscriptions, billing_events (raw Dodo webhook log, idempotent by event id), entitlements.

Add indexes for the hot paths (board→column→position, user→due date, user→updated_at, FTS). Provide a migration workflow (pnpm db:generate, pnpm db:migrate, pnpm db:studio) and a pnpm db:seed command (section 12).

8. AI COPILOT

Principle: the AI uses exactly the same tool layer as the API and MCP server, scoped to the signed-in user.

Entry points: full page /ai, a slide-over available on every page (Ctrl/Cmd+J), the "Ask AI…" row in the command palette, and contextual buttons (Summarize board, Improve this bullet, Plan my day, Tailor CV to this job, Prep me for this interview).
Providers: provider-agnostic. Users may bring their own key (stored encrypted at rest with envelope encryption; never sent to the client after saving) or use a platform default if the operator configured one. Show provider, model and rough token cost. Streaming responses, stop button, retry, regenerate.
Tools (function calling) mirrors section 9's tool list: search, list/get/create/update/move cards, complete tasks, log habits, add job applications and change stage, read/edit CV sections (proposals only), create notes, get daily brief, run weekly review, create board from template.
Safety model:
Read tools run freely. Write tools produce a proposal card ("Move 3 cards to Done", with a diff/preview) that the user approves with one key (y) or rejects (n). A per-tool "auto-approve" setting is allowed for low-risk actions only (create task, log habit).
Destructive tools (delete, bulk archive, overwrite CV) always require explicit confirmation and are never auto-approvable.
Prompt-injection defense: content read from the user's own data or the web (job postings, pasted text, note bodies) is untrusted data. Wrap it in delimiters, instruct the model never to follow instructions found inside it, and never let it trigger tools directly without the approval step. Add tests with malicious job-description fixtures.
Rate-limit and budget-cap per user (Upstash), log every tool call to audit_log with actor = ai.
Memory / context: build a compact, always-fresh "user context" (goals, active boards, career targets, preferences) injected server-side. Long-term memory items are visible, editable and deletable by the user in /settings/ai.
Proactive but quiet: optional morning brief and Friday review draft, generated on a schedule (QStash/Vercel Cron), delivered in-app and optionally by email. Off by default; opt-in at onboarding.
Quality bar: evaluate with a small fixture suite (evals/): task parsing accuracy, CV rewrite never inventing facts, correct tool selection on 30+ prompts, injection resistance. Run in CI on demand.
9. OPEN DATA ACCESS: REST API, MCP SERVER, WEBHOOKS

The user's data must be reachable from any tool: scripts, Zapier/n8n/Make, iOS Shortcuts, terminals, and AI agents (Claude, Cursor, etc.).

9.1 REST API /api/v1
Resource-oriented, JSON, cursor pagination (?limit=&cursor=), filtering (?status=&due_before=&board_id=&q=), sparse fields, ETag/If-Match on updates, Idempotency-Key header on all POSTs (stored in Upstash for 24 h), consistent error shape { error: { code, message, details, request_id } }.
Resources: boards, columns, cards (+ /move, /complete), tasks (alias view), jobs, companies, contacts, resumes (+ /export?format=pdf|docx|md|json), skills, achievements, habits (+ /logs), goals, notes, transactions, focus-sessions, search, daily-brief, export, me.
Ingest endpoint for fast pushing from anywhere: POST /api/v1/ingest with { type: "task"|"job"|"note"|"habit_log"|"transaction"|"card", data: {...}, source: "shortcut|zapier|cli|email|extension" }. Validates with the same Zod schemas, returns the created record.
OpenAPI 3.1 generated from the Zod schemas (e.g. zod-openapi / @asteasolutions/zod-to-openapi), served at /api/v1/openapi.json, with interactive docs at /docs/api (Scalar or Swagger UI, restyled to the theme). Ship copy-paste curl, fetch, and Python examples.
Auth: Authorization: Bearer lifeos_live_… personal API keys (created in /settings/integrations): shown once, stored as SHA-256 hash plus prefix, scoped (read:*, write:tasks, write:jobs, write:notes, admin:export…), optional expiry, last-used tracking, instant revoke. Session cookies also work for the web app.
Rate limits via @upstash/ratelimit (sliding window, per key and per IP), returning X-RateLimit-* and Retry-After.
Ship a tiny CLI (npx lifeos … or a Go/Rust/Node single binary, choose one) supporting lifeos add "call recruiter tomorrow 3pm #career", lifeos today, lifeos jobs move <id> interview. Nice-to-have after MVP.
9.2 MCP server /api/mcp
Streamable HTTP transport (verify the current MCP spec version and SDK docs at build time and follow them). Auth via Bearer API key and OAuth 2.1 flow if the SDK/client ecosystem supports it (implement OAuth after the API-key path works; document both).
Tools (each with Zod input schema, a precise description written for LLMs, readOnlyHint/destructiveHint annotations, and scope checks): search, get_daily_brief, list_boards, get_board, create_board_from_template, list_cards, get_card, create_card, update_card, move_card, complete_card, delete_card (destructive), add_comment, list_jobs, add_job_application, update_job_stage, log_interview, get_pipeline_stats, list_resumes, get_resume, propose_resume_edit (returns a proposal, never writes directly), create_note, get_note, append_to_daily_note, list_habits, log_habit, get_habit_stats, list_goals, update_goal_progress, start_focus_session, add_transaction, export_data.
Resources: lifeos://today, lifeos://boards/{id}, lifeos://jobs/pipeline, lifeos://resume/{id}, lifeos://notes/daily/{date}.
Prompts: plan_my_day, weekly_review, job_search_coach, tailor_resume(job_id), interview_prep(job_id).
Return concise, token-efficient structured content (IDs, titles, key fields) plus human-readable text; support limit and fields to keep context small.
Publish setup docs for Claude Desktop/Claude Code/Cursor/VS Code (/docs/mcp) with copy-paste config snippets, and an in-app "Connect an AI agent" screen that generates the key and the exact snippet. Also serve /llms.txt and /llms-full.txt describing the API and MCP tools.
Same service layer, same audit log (actor = mcp:<client-name>), same rate limits and plan checks as the REST API.
9.3 Webhooks and integrations
Outgoing webhooks: subscribe to events (card.created|updated|moved|completed, job.stage_changed, habit.logged, note.created, goal.progress, …). HMAC-SHA256 signature header, retries with exponential backoff (QStash), delivery log with replay in /settings/integrations.
Incoming: the /ingest endpoint plus a per-user capture email address (v1.1) and iOS/Android Shortcut recipes in docs.
Integrations (priority order): GitHub (OAuth: import repos as portfolio projects and skills, link issues/PRs to cards), Google Calendar (two-way sync, v1.1), ICS feed export/subscribe for all dated items, Slack/Discord notifications (webhook URL), Telegram bot (v1.1).
Data portability: full JSON export, per-module CSV, Markdown export of notes, JSON Resume export, and a matching import. Document the schema.
10. SECURITY AND PRIVACY (HARD REQUIREMENTS)
Tenant isolation: every service function takes an authenticated ctx (userId, workspaceId, actor, scopes) and every DB query includes the owner filter. Write a test suite that creates two users and proves user A can never read, update, move, delete, search, export, or AI-tool-access user B's data through each surface (UI actions, REST, MCP, AI tools, webhooks, export).
Auth hardening: argon2id/bcrypt via the auth library, email verification, password-reset tokens single-use and short-lived, secure httpOnly SameSite cookies, CSRF protection on cookie-authenticated mutations, optional TOTP 2FA and passkeys (verify library support), session list with "sign out everywhere", login rate limiting and lockout backoff via Upstash.
API keys: stored hashed, shown once, scoped, revocable, with usage logs. Secrets at rest (AI provider keys, webhook secrets) encrypted with an app-level key (AES-256-GCM, key from env, rotation documented).
Input/output: Zod validation on every boundary, output encoding for markdown (sanitize with a strict allow-list such as rehype-sanitize), no dangerouslySetInnerHTML without sanitization, strict CSP and security headers (next.config / middleware), SSRF protection for any URL-fetching feature (job clipper, link previews): block private IP ranges and metadata endpoints, cap size and time.
Rate limits and abuse controls on auth, API, ingest, AI, PDF export and webhook delivery.
Privacy: minimal analytics (privacy-friendly, opt-out; no third-party trackers by default), clear data-use page, GDPR-style export and hard delete (with a 7-day grace period), audit log visible to the user, no user content used to train anything, AI provider calls disclose what data is sent.
Dependencies: lockfile, pnpm audit in CI, Dependabot/Renovate config, no unmaintained packages for security-sensitive paths.
Backups and recovery: document Turso point-in-time recovery/branching and a nightly logical export job to object storage.
11. FREE TODAY, BILLING-READY TOMORROW (DODO PAYMENTS)

Current policy: everything is free and unlimited for everyone. Do not show paywalls, upgrade nags, or plan badges in the UI while BILLING_ENABLED=false.

Build the plumbing now so paid plans can be enabled by configuration:

config/plans.ts defines plans (free, pro, team) with limits and features (boards, cards, AI messages/month, API requests/day, MCP access, CV exports, storage, history retention, teams). In the current release, free limits are effectively unlimited (Infinity) and all features are on.
A single entitlements service (can(ctx, feature), limit(ctx, key), assertWithinLimit(ctx, key)) is called from the service layer (so UI, REST, MCP and AI are all gated identically). Right now it always allows, but the calls and tests exist.
Dodo Payments integration (read current docs first: products/pricing, checkout sessions, customer portal, subscriptions, webhooks, test mode; use the official SDK and the Next.js adapter if available):
POST /api/billing/checkout creates a checkout session for a plan; GET /api/billing/portal opens the customer portal.
POST /api/webhooks/dodo verifies the signature per Dodo's documentation, is idempotent (dedupe by event id in billing_events), and handles subscription created / active / renewed / on-hold / cancelled / failed and payment succeeded/failed by updating subscriptions and entitlements.
Everything is disabled and hidden unless BILLING_ENABLED=true and Dodo env vars are present. Provide test-mode instructions and a webhook replay script. Add integration tests using recorded fixtures.
/settings/billing shows "Free forever during launch" and, when enabled, plan, renewal date, invoices (portal link) and cancel.
Founder grandfathering: record joined_during_free_period=true and a configurable FOUNDER_PERKS policy so early users can be given lifetime benefits later without a migration.
Handle merchant-of-record and tax through Dodo's model; do not build tax logic yourself. Document currency and regional availability findings in DECISIONS.md after checking Dodo's current docs (relevant because the operator is in Bangladesh).
Public /pricing page renders from plans.ts and currently shows "Free" with a "Pro coming later, early users are protected" note behind a flag.
12. SEED / DEMO DATA (RESEARCH-BASED, NO INVENTED FACTS)

Create pnpm db:seed and a "Try the demo" button that loads a read-only-resettable demo workspace flagged is_demo=true, based on the public GitHub profile https://github.com/swadhinbiswas.

Research steps (do them, do not guess):

Fetch https://api.github.com/users/swadhinbiswas and /repos?per_page=100&sort=updated (unauthenticated is fine; handle rate limits), and read the profile README (swadhinbiswas/swadhinbiswas), pinned repos, and the public links listed on the profile. Capture repo names, descriptions, primary languages, topics, stars and dates.
If the linked personal site (https://swadhin.cv) is publicly reachable, read it for the CV structure. Use only what is publicly displayed there.
Save the raw research to docs/research/github-swadhinbiswas.json and summarize it in docs/RESEARCH.md.

What the public profile currently shows (verified when this prompt was written; re-verify):

Name Swadhin Biswas, handle swadhinbiswas, based in Dhaka, Bangladesh; headline "MLOps & Data Engineer | Python · Spark · Kubernetes | Pipeline Automation | Open to EU Relocation"; about 84 public repositories.
Public links: personal sites swadhin.cv and swadhin.my.id, ORCID, X @swadh1n, LinkedIn in/swadh1n, Hugging Face swadhinbiswas.
Organizations: Roast-Lang, nanoLMs, StreamBerryLabs.
Pinned projects: opengrammar (TypeScript, open-source self-hosted Grammarly alternative), FAANG-Playbook (Astro; guide with 1,400+ LeetCode problems, interview strategies and study plans), OpencodeHub (TypeScript; self-hosted Git platform with SSH, Actions-compatible pipelines and AI code reviews). Other public repos mentioned on the profile README include fetchx (Rust, neofetch replacement) and ls-f (Rust, ls with Nerd Font icons).

Seed content to generate from that research:

CV (JSON Resume): basics (name, label, location, public profile links), projects (from the repos above with real descriptions and languages), skills derived from repo languages/topics and the headline (Python, Spark, Kubernetes, MLOps, data pipelines, TypeScript, Rust, Astro). Leave work, education, awards empty or clearly marked "add yours" unless publicly stated on the site you fetched. Do not invent employers, dates, degrees or metrics. Do not put the private email address in seed data.
Career targets: a job-search board reflecting the public "Open to EU Relocation" signal: work mode, visa/relocation-required fields, target roles (MLOps Engineer, Data Engineer, Platform/ML Infrastructure Engineer).
Job pipeline sample: 8–12 cards spread across stages using obviously fictional companies (e.g. "Acme Data GmbH (sample)"), each tagged sample, with realistic fields, interview logs and offer comparison so every UI state is demonstrated. Sample data must be visibly labelled and one-click removable.
Interview prep: a study board using the real structure of the FAANG-Playbook repo (patterns, difficulty ladders, weekly plans) as the source of categories. Link to the repo; do not copy its content wholesale.
Projects board (Idea → Spec → Build → Ship): cards for the real public repos, with sample tasks (e.g. "write README", "add CI") that are plausible but marked as sample.
Daily/weekly: habits (LeetCode practice, reading, workout, writing), a weekly-review template, 30 days of generated habit logs and focus sessions so charts look alive (all flagged as sample/generated).
Templates: additional generic seeds for Student, Freelancer and Blank so non-technical users see themselves in the product.
GitHub import for everyone: on onboarding, a signed-in user who connects GitHub can import their own repos as portfolio projects and infer skills from languages, with a review step. The demo is just this feature run for the sample profile.
13. QUALITY BARS
Performance: LCP < 2 s, INP < 200 ms, CLS < 0.05 on the dashboard (Lighthouse CI budget in the repo). Route-level code splitting, streaming with Suspense, image/font optimization, Redis caching for expensive aggregates with correct invalidation (tag-based), DB indexes verified with EXPLAIN QUERY PLAN.
Reliability: graceful error boundaries per panel (a failed widget never blanks the page), offline banner, retry logic, idempotent mutations.
Accessibility: axe checks in Playwright on every route in every theme; manual keyboard-only walkthrough documented.
Testing: unit tests for services (fractional index, recurrence, NL capture, entitlements, plan limits, streak logic, funnel math); integration tests for API and MCP with a real libSQL file DB; e2e for the golden paths (sign up → template → create/move card → add job → build CV → export PDF → create API key → call API → connect MCP → AI proposal approve/reject). Target ≥ 80 % coverage on server/services.
Docs: README.md (5-minute quickstart), docs/ARCHITECTURE.md, docs/API.md + OpenAPI, docs/MCP.md, docs/THEMING.md, docs/SELF_HOSTING.md, docs/CONTRIBUTING.md, docs/SECURITY.md. In-app /docs mirrors them.
Design QA: side-by-side screenshots of each LifeOS screen against its NexaCRM counterpart in docs/design-qa/ (layout, spacing, density, states). Fix every meaningful structural difference. The skin should differ; the craft level should not.
Copy: friendly, concise, no jargon, no exclamation-mark overload. Every error message says what happened and what to do next.
14. BUILD PHASES AND ACCEPTANCE CRITERIA

Do the phases in order. At the end of each phase, run all checks, commit, and print a short status report (what shipped, what you ran, what you saw, known gaps).

Phase 0: Research and plan (no app code yet). Produce docs/RESEARCH.md covering: (a) NexaCRM design measurements or screenshot analysis; (b) competitor teardown with concrete takeaways from Linear, Trello, Notion, Todoist, Things, Sunsama, Huntr, Teal, Simplify, Reclaim/Motion, Habitica, Obsidian; (c) TUI inspiration study (lazygit, btop, k9s, Charm/Bubble Tea, opencode) with 10 concrete UI decisions; (d) best-practice notes for kanban (fractional indexing, optimistic updates, accessibility of DnD), CV/ATS parsing, and job-search funnel metrics; (e) library verification table (name, version, docs URL, key API used, risk); (f) GitHub seed research (section 12); (g) Dodo Payments, Turso, Upstash, MCP spec findings. Also produce docs/ERD.md, docs/DECISIONS.md, and an MVP scope cut-list. Accept when: the docs exist, every claim cites a source URL or a measurement, and you list open risks with mitigations.

Phase 1: Foundation. Scaffold Next.js 16 + TS + Tailwind v4 + shadcn/ui, env validation, Drizzle + Turso connection and migrations, Upstash client, Better Auth (email + GitHub + Google), the theme system (all six presets, customizer with every NexaCRM option, persisted per user), TUI primitives (Panel, StatusLine, Kbd, AsciiMeter, Spark), the app shell (sidebar variants and modes, header, breadcrumbs, status line), command palette skeleton, CI, lint, format, test harness. Accept when: sign up/in/out, verify email, and reset password work end-to-end; switching every theme and every customizer option updates the UI live and persists across reload; axe passes on shell routes.

Phase 2: Boards engine and tasks. Section 6.1 and 6.2: full Kanban with all views, fractional ordering, optimistic updates, keyboard navigation, undo, templates, the task inbox/today/upcoming, natural-language capture, recurring tasks, global command palette with real search. Accept when: you can drag 500 cards smoothly, complete the entire golden path by keyboard only, and all board tests pass.

Phase 3: Career module. Section 6.3: job pipeline, companies, contacts, interviews, offers, analytics, CV builder with versions, live preview and PDF/DOCX/JSON export, skills, achievements, portfolio, interview prep. Accept when: a user can add a job in under 10 seconds, produce a targeted ATS-safe PDF CV in under 3 minutes, and see funnel analytics update correctly (verified by tests with known fixtures).

Phase 4: Dashboards and life modules. Section 6.4 to 6.9: four dashboards with configurable widgets, habits, goals, notes/journal with backlinks and FTS search, calendar, focus timer, finance-lite, health-lite, learning, reviews, notifications, PWA. Accept when: every KPI links to its source list and matches a hand-calculated fixture; offline quick-capture syncs after reconnect.

Phase 5: API, MCP, webhooks, docs. Section 9 in full, with docs and the in-app "Connect an AI agent" flow. Accept when: you (a) create an API key in the UI, (b) push a task with curl and see it appear live, (c) connect a real MCP client to /api/mcp and successfully run search, create_card, move_card and get_daily_brief, and (d) verify cross-tenant isolation tests pass on both surfaces. Show the transcripts.

Phase 6: AI copilot. Section 8 with approval-gated write tools, injection defenses, evals, provider settings. Accept when: eval suite passes thresholds and the injection fixtures cannot trigger unapproved writes.

Phase 7: Billing scaffold, settings, data ownership. Section 11, plus export/import/delete-account and audit-log UI. Accept when: with BILLING_ENABLED=false no billing UI appears and nothing is limited; with test-mode Dodo credentials a checkout → webhook → entitlement change round-trip works and replaying the same webhook is a no-op.

Phase 8: Onboarding, templates, seed, landing. Section 12, onboarding flow (60-second setup), template gallery, demo mode, public landing page with TUI hero (animated terminal demo of quick-capture → kanban), pricing page, docs site. Accept when: a fresh visitor can try the demo without an account, and a new user reaches a populated dashboard in ≤ 60 s.

Phase 9: Hardening and release. Full a11y sweep, Lighthouse budgets, security review against section 10, load test the API (k6 or autocannon), dependency audit, docs/SECURITY.md, self-hosting guide, changelog, tag v0.1.0, deploy to Vercel preview, final report. Accept when: all checks are green and the release checklist in docs/RELEASE.md is fully ticked.

15. NON-GOALS FOR v1 (DO NOT BUILD YET)

Real-time multi-user collaboration and team permissions (schema is ready, UI is not), native mobile apps (PWA only), bank connections, voice AI, a marketplace, custom-domain hosting for public CVs, and any paid-plan enforcement.

16. DEFINITION OF DONE AND FINAL REPORT

The project is done when:

Every acceptance criterion above is met and demonstrated (commands run and output shown), CI is green, and the app is deployed to a Vercel preview.
A new user can sign up, take the guided setup, capture tasks by keyboard, run a job pipeline on Kanban, build and export a CV, connect an AI agent over MCP, and get an AI daily brief, all on the free plan, in the TUI-styled UI.
No dead UI, no lorem ipsum, no unexplained any, no unhandled promise rejections in the browser console on any route.

Your final message must include: a feature checklist mapped to this document's sections (done / partial / not done, with reasons), how to run and deploy, the env var list, links to each doc, screenshots of every major screen in two themes, known limitations, and a prioritized v1.1 backlog.

17. START NOW
Confirm you have read this document by replying with a 10-line summary of the product, the stack, and the phase plan (no code).
Begin Phase 0 immediately: fetch and read the sources, then write the research docs.
Continue phase by phase without waiting for approval, except to report status at each phase boundary. If you hit a real blocker (missing credentials, a paid service, an unreachable source), record it, choose a safe fallback, and keep moving.

Build it like you would want to use it every day.
