# Feature parity with edrisranjbar/lifeos

**Status:** gap analysis, not a plan with dates. LifeOS (this repo) is a Next.js/TypeScript/Turso
app; `edrisranjbar/lifeos` is a PHP/MySQL app. Nothing is ported line-for-line — features are
re-implemented in our stack and our design system (ADR-001..ADR-136). This document lists what the
other project ships and where we stand, so the work is visible rather than implicit.

## Already at parity (no work)

- Habits (daily check-off, streaks, consistency) — `src/server/habits`
- Goals / OKRs with key results and linked entities — `src/server/goals`
- Kanban boards (labels, priorities, due dates, checklists, comments) — `src/server/boards`
- Finance: accounts, transactions, budgets, subscriptions — `src/server/finance`
- Focus timer — `src/server/focus`
- Notes with wiki-links, backlinks, FTS search, tags, daily notes — `src/server/notes`
- Calendar, health, learning, reviews, contacts, inbox, tasks, trash, dashboard — respective modules
- AI copilot + MCP server (15+ tools) — `src/server/ai`, `src/server/api/mcp`
- Multi-locale (en/bn), self-hosting, Docker, cron, weather, day signals

## Gaps, ordered by effort

### Small (hours each)

1. **Secret notes** — _shipped in this commit (ADR-136)._ A note flagged secret is hidden from
   API/MCP reads and full-text search by default; the owner still sees it in the UI with a toggle
   and a badge. The flag is a visibility control, not encryption.

2. **Habit-driven SMART goals.** The other repo derives a goal's progress from habit attendance
   (unique completed dates inside an inclusive start→deadline window, capped at 100%), with
   automatic quarter milestones. We currently treat a habit link as "done today" (`linkedProgress`),
   which is a snapshot, not attendance. Needs: a `progressSource` (`checklist` | `measure` | `habit`)
   and a `habitProgress` (`habitId`, `targetDays`, optional window) on key results, derived
   `progress`/`effectiveStatus` on GET, and the goal editor showing count + milestones + a link to
   Habittify. Touches `src/server/goals`, the schema, the goals UI, the API and MCP.

3. **Attachments on kanban cards.** We have labels, checklists and comments; attachments are the
   remaining card-anatomy item. Needs storage + a card-attachments table + UI.

### Medium (days each)

4. **Focus soundtrack + time-of-day landscape.** Pomodoro already exists; the other repo adds a
   built-in focus soundtrack and a landscape that follows the time of day. UI + audio assets only;
   no data model change.

5. **Email / daily summary.** We have the transport (`src/server/email`) and opt-in digests
   (`morningBrief` in AI prefs). The gap is a daily summary mail and the per-user opt-in surface.
   Mostly wiring over existing primitives.

6. **Calendar shows finance dues.** Depends on gap 7 (obligations) — the calendar filter and the
   due-occurrence loader.

### Large (multi-session)

7. **Obligations / debts & credits** (finance). The biggest single gap: two directions (I owe /
   owed to me), three schedules (one-time, recurring same-amount, split-a-total), generated dues
   with stable occurrence ids, payment linking to ledger entries with atomic undo, reconciliation
   when a linked expense changes, and Calendar integration. New `edi_obligations_v1` document,
   `lib/obligations`-equivalent service, API endpoints, and Finance UI. Roughly a week of careful
   work; do not rush it.

8. **Growth workspace (six life dimensions).** Religion & Spirituality, Health, Relationships &
   Family, Finance, Self Growth, Fun & Rest — long-term goals linked to SMART goals and habits,
   plus weekly/monthly/quarterly reviews (an 8-step flow with per-dimension reflection, next step,
   and a numeric snapshot). New workspace, new data model, new review cadence. The headline feature
   of the other project; deserves its own phase.

9. **Multi-admin with private workspaces.** Separate accounts with private data, password reset by
   admins, per-account storage. Our auth is single-tenant-ish. Touches `src/server/auth`,
   tenant scoping in every service, and settings. High risk; needs its own ADR.

## Explicitly not planned

- **PHP/MySQL runtime, shared hosting, no-build-step frontend.** Our stack is the deliberate
  choice (ADR-001..); "do not change our design pattern" applies here too.
- **Toman as default currency / Tehran timezone defaults.** We keep the user's configured
  timezone and currency; defaults are not regionalised.
- **MCP tool count parity (15).** We already exceed it and add provider-specific tools; the count
  is not the goal, coverage is.

## Order of attack (suggested)

Secret notes → habit-driven goals → attachments → focus soundtrack → email summary → obligations
→ Growth → multi-admin. Each gets its own ADR and its own commit; none should be bundled.
