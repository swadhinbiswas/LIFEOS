# Gap analysis: what is missing between LifeOS and `prompt.md`

The spec (`prompt.md` §16) asks the final report for "a feature checklist mapped to this document's
sections (done / partial / not done, with reasons)" and "a prioritized v1.1 backlog". This file is
that artifact. It is written from a code audit of `src/` on **2026-09-27**, not from the docs — the
docs are stale in several places (see "Doc drift" at the end), and where they disagree with the code
the code is reported.

Method: every route in the §5 IA was compared against `src/app`; every §6 sub-bullet was checked in
the service/UI that would implement it; §8–§11 were checked in `src/server/{api,ai,webhooks,auth}`,
`next.config.ts` and `package.json`. A capability counts as DONE only when the wired code exists —
a schema table or a config enum is not an implementation. Runtime behaviour (drag auto-scroll,
offline sync) was not exercised here; `pnpm e2e` covers the golden paths separately.

Tiers: **P0** = a hard requirement of §10 or a broken promise of §9/§16; **P1** = a flagship feature
the product is judged on; **P2** = polish and completeness.

## Verdict by spec section

| Section                      | Verdict     | One line                                                                   |
| ---------------------------- | ----------- | -------------------------------------------------------------------------- |
| §4.1–4.2 TUI look, themes    | DONE        | six presets, live customizer, all TUI primitives, contrast-tested          |
| §4.3 keyboard model          | PARTIAL     | core shortcuts bound; `g`-prefix set differs; no remapping; no vim mode    |
| §4.4 accessibility           | DONE        | axe on every route/theme, target-size spec, focus visible                  |
| §5 routes                    | PARTIAL     | most routes exist; several spec routes absent (below)                      |
| §6.1 board engine            | PARTIAL     | all five views render; card anatomy + column CRUD UI missing               |
| §6.2 tasks/planning          | PARTIAL     | capture/inbox/recurrence strong; subtasks, time-blocking missing           |
| §6.3 career/CV               | PARTIAL     | pipeline strong; offer scoring, company pages, CV build/PDF/import/AI weak |
| §6.4 habits/goals            | PARTIAL     | goal engine done; habit schedules/heatmap/stats thin                       |
| §6.5 notes/journal           | PARTIAL     | backlinks/FTS/pins done; not a markdown editor; no encryption              |
| §6.6 finance/health/learning | PARTIAL     | finance-lite/health done; no FX/CSV import; learning thin                  |
| §6.7 focus                   | PARTIAL     | timer + status line done; no task link in UI, no reports/notifications     |
| §6.8 dashboards              | PARTIAL     | four variants, reorder done; widgets incomplete, no resize                 |
| §6.9 global                  | PARTIAL     | PWA/i18n/tz/trash done; no demo, thin activity feed, no push/quiet hours   |
| §7 stack                     | PARTIAL     | all major deps per spec; MCP SDK dev-only, no pino, no MSW                 |
| §8 AI copilot                | PARTIAL     | approval gate + evals done; CV/tailoring tools shallow                     |
| §9 REST/MCP/webhooks         | PARTIAL     | shape and OpenAPI done; many resources/tools missing                       |
| §10 security                 | PARTIAL     | isolation/CSP/hashing done; **no SSRF guard**, no 2FA/passkeys             |
| §11 billing                  | DONE        | flag-gated, entitlements, Dodo round-trip, founder field                   |
| §13 quality bars             | PARTIAL     | Lighthouse/load/axe green; no coverage threshold, no MCP.md                |
| §16 final report             | **MISSING** | this file (plus the backlog below)                                         |

## Deliberate deviations from the spec (documented in `docs/DECISIONS.md`)

These are not oversights; they are recorded choices that happen to disagree with `prompt.md`. Each
needs a product decision, not a bug fix.

1. **Demo mode and the seed are removed** — ADR-123 deleted `/demo`, `db:seed`, `config/seed-profiles`
   and the onboarding "start from a profile" step. §12 and the Phase 8 acceptance criterion ("a fresh
   visitor can try the demo without an account") are therefore unmet by design. `CHANGELOG.md` still
   claims a "no-account demo", which is wrong.
2. **MCP is hand-rolled JSON-RPC, the SDK is a devDependency** — ADR-064/071. §7 lists the official
   SDK; the runtime route does not use it.
3. **PDF export is the browser's print dialog, not a server render** — ADR-088. §6.3 asks for a
   server-side PDF with selectable text; the current path cannot be produced headlessly and is not
   ATS-verifiable in CI.
4. **Scheduled work is cron routes, not QStash** — ADR-066/069.
5. **The calendar is hand-built**, not React Big Calendar / FullCalendar.
6. **Contacts live at `/contacts`**, not `/career/contacts` — ADR-132 (deliberate: contacts are
   people, not recruiters).

## P0 — hard requirements and broken promises

- **SSRF: outbound webhook delivery fetches a user-supplied URL with no guard.** `createWebhook`
  stores it and delivery `fetch`es it with only a timeout. §10 requires blocking private IP ranges
  and metadata endpoints for any URL-fetching feature. No `isPrivateIp`/safe-fetch helper exists.
  Fix: validate scheme, resolve DNS, reject loopback/link-local/ULA/metadata, and disable redirects.
- **REST resource coverage.** §9.1 lists `boards`, `columns`, `cards` (+`/move`, `/complete`),
  `tasks` (alias), `companies`, `contacts`, `resumes`, `skills`, `achievements`, `search`,
  `daily-brief`, `me`. The registry implements jobs/notes/habits/goals/accounts/transactions/
  subscriptions/health/courses/books/reviews/notifications; `cards` exists but has no `/move` or
  `/complete`, and there is no `tasks` alias, `search`, `daily-brief` or `me`.
- **MCP tool coverage.** 11 of the ~32 tools in §9.2 exist (`search`, `create_card`, `move_card`,
  `get_daily_brief`, `list_resumes`, `get_resume`, `propose_resume_edit`, `list/create/update/move`
  job application). Missing include `list_boards`, `get_board`, `create_board_from_template`,
  `list_cards`, `get_card`, `update_card`, `complete_card`, `delete_card`, `add_comment`,
  `log_interview`, `get_pipeline_stats`, `create_note`, `append_to_daily_note`, `list_habits`,
  `log_habit`, `get_habit_stats`, `list_goals`, `update_goal_progress`, `start_focus_session`,
  `add_transaction`, `export_data`. Resources and prompts are also a renamed subset.
- **`POST /api/v1/ingest` does not match the spec.** It accepts `{ text, columnName }` for tasks, not
  `{ type, data, source }` for task/job/note/habit_log/transaction/card, and `/ingest/job` is absent.
- **Rate limits are narrower than `docs/RELEASE.md` claims.** No limit on CV export, outbound webhook
  delivery, or Dodo webhook; AI chat is capped by monthly budget, not the sliding-window limiter.
- **No server/services coverage threshold.** §13 targets ≥80%; `vitest.config.ts` sets none and CI
  runs `pnpm test`, not coverage. The number is currently unknown.
- **Doc drift** (below) — the release docs assert things the code does not do.

## P1 — the features the product is judged on

**Board engine (§6.1)**

- **Calendar, Timeline/Gantt and Grid board views** — shipped 2026-09-27: all five views render over
  the same payload (`grid-view.tsx`, `calendar-view.tsx`, `timeline-view.tsx`), keyed by spec §4.3's
  `1`…`5` and restricted by `RENDERED_VIEWS` so the switcher never offers a blank one.
- No **column management UI**: create/rename/recolor/reorder columns have service functions
  (`createColumn`…`deleteColumn`) but no Server Actions or UI. WIP limits, collapse and done flags
  are not editable.
- Card anatomy incomplete: **checklists/subtasks and a label editor shipped 2026-09-27** (labels now
  display on the card face; board-wide rename/delete is still absent); still no attachments, no
  comments/activity log, no custom fields, no assignee, no cover colour; `card_fields` config is
  stored but never read.
- No **swimlanes/grouping** on the kanban (table groups only), no **table** column resize/reorder/
  pin, inline editing or aggregation row, no lasso/shift-click selection, no bulk label/set-date.
- **Import** is JSON-only and skips boards/transactions/projects/skills; no CSV, Trello or Notion
  import. Version conflicts roll back the whole row rather than resolving per field.

**Career (§6.3)**

- **Offer comparison** has no weighted scoring or currency conversion (§6.3 asks for both).
- **No company records page** (`companies` table and `ensureCompany` exist; no route, no research
  checklist).
- **CV is the biggest gap.** No server-side PDF; no live split-screen A4 preview; one template
  (`"classic"`), no section drag-reorder or per-section visibility; no page-fit indicator; no
  version variants/`base_id` despite `resume_versions` snapshots; `resume_id` is never written on a
  job, so "which CV went where" cannot be reported; JSON Resume shape is partial (awards/publications/
  languages/certificates are unmodelled passthrough); no import (JSON Resume, PDF/DOCX, GitHub).
- **AI assist is shallow**: only `propose_resume_edit` for summary/label plus a derived ATS checklist.
  No bullet rewrite with metrics, no tailoring to a pasted JD, no keyword-gap analysis, no
  cover-letter draft, no per-change diff/accept (§6.3 asks for all of these).
- **Interview log** stores interviewers/questions/outcome but exposes only kind/date/feedback; STAR
  stories are not linked to a job; **no spaced repetition, no AI mock interview**; the coding-problem
  tracker has a service but the page never renders problems.
- **Skills**: no "last used"/"target level", no gap analysis against saved JDs. **Achievements** are
  not taggable by skill/project and have no "add to CV". **Portfolio** "GitHub sync" is a one-shot
  import of a static labelled sample, not a live sync.

**Notes, life modules, dashboards**

- Notes are a plain `<textarea>`: no markdown rendering, no slash commands, no templates, no
  attachments; per-entry encryption is a schema column with no implementation; "energy" logging is
  absent; the daily note has no shortcut.
- Habit schedules are a free-text `cadence` string (no RRULE, no schedule UI); freeze days are never
  settable; the heatmap is a 14-day strip, not the yearly one; no per-habit stats view.
- Finance: no CSV import, no exchange-rate cache or conversion (currencies are stored separately).
  Learning: no article queue, no highlights UI, no spaced repetition. Focus: the timer never passes a
  linked card, and there are no manual time entries, sound/browser notifications or reports by
  board/tag/project.
- Dashboards: widgets are show/hide + reorder only (no **resize S/M/L**); the Overview variant lacks
  the activity heatmap, boards summary and upcoming-7-days; Career lacks next interviews, resume-
  version performance and a skills-gap radar; Productivity lacks cycle time, focus-by-hour heatmap
  and backlog-age histogram; KPI cards have no braille sparkline and their tooltip shows the label,
  not the definition.
- **`/analytics`** (cross-module insights, §5) does not exist; only `/career/analytics` does.
- Global search covers cards/boards via `LIKE` and notes via FTS5, but not one unified FTS5 search;
  no semantic search; the activity feed is AI-audit-only.

## P2 — settings, marketing, keyboard, ops

- Missing routes from §5: `/settings/shortcuts` (shortcut remapping is a dead `user_settings` column
  and a static `config/shortcuts.ts`), `/settings/notifications`, `/settings/data-model`, `/privacy`,
  `/terms`, `/changelog`, `/accept-invite`, `/automations` (v1.1 by spec).
- Keyboard: `g`-prefixed nav binds `t i c b n s a` (spec wants `g d`, `g j`, `g h`, `g c` = CV);
  `e`/`d`/`p`/`m`/`#` are unbound; view keys cover only `1`/`2`; no vim modal option.
- §9 extras: no per-user capture email, no Slack/Discord/Telegram delivery, no Google Calendar sync
  (v1.1), no MCP OAuth 2.1, no in-app "Connect an AI agent" snippet screen, no `docs/MCP.md`.
- §10 extras: no TOTP 2FA, passkeys, magic link, or session list with sign-out-everywhere.
- §13 docs: no documented manual keyboard-only walkthrough; `docs/API.md`, `THEMING.md`,
  `CONTRIBUTING.md` exist.
- §7: no pino structured logging, no MSW.

## Doc drift (fix or delete — do not let these contradict the code)

- `CHANGELOG.md` "Known limitations" says the CV builder is not implemented — `/career/cv` and its
  export route exist. It also claims a no-account demo (removed by ADR-123) and plaintext webhook
  secrets (now encrypted).
- `docs/RELEASE.md` claims documentation covers "ADR-001 … ADR-087" (the log reaches at least
  ADR-134) and lists rate limits the code does not apply. Phase 9's two unticked items (Vercel
  preview, and the load/Lighthouse note) remain open.
- `AGENTS.md` cites "643 unit tests" in one place and "271 unit + 9 evals" in another; the observed
  count on 2026-09-27 is **715 unit tests / 94 files**.
- `docs/RESEARCH.md` (R12) and `docs/MVP-SCOPE.md` claim a keyboard-only walkthrough is documented;
  no such document exists.
- `docs/HANDOFF.md` lists board undo/redo as open; `boards.spec.ts` now covers undo/redo and passes.

## Prioritized v1.1 backlog

Ordered by (hard requirement first, then user-visible value per unit of work). Effort is rough.

1. **SSRF guard + the missing rate limits** (P0, S) — a shared safe-fetch helper with tests;
   `withinRateLimit` on CV export, webhook delivery and the Dodo webhook.
2. **Fix the docs** (P0, S) — CHANGELOG/RELEASE/AGENTS drift above, so the release record is true.
3. **Enforce a coverage floor and publish the number** (P0, S) — vitest thresholds + a CI coverage job.
4. **REST/MCP parity** (P0, M) — the remaining §9.1 resources (`tasks` alias, `boards`, `columns`,
   `search`, `daily-brief`, `me`, card `/move` + `/complete`) and the remaining §9.2 tools, all as
   thin adapters over existing services; align `/ingest` to `{ type, data, source }`.
5. **Decide the demo question** (product, S) — restore a read-only labelled sample workspace (which
   also restores `db:seed`) or amend the spec; either way, delete the false CHANGELOG claim. §16
   "try it without an account" is otherwise permanently unmet.
6. **Board views: Calendar, Timeline and Grid over the same data** (P1, M–L) — **done 2026-09-27**;
   §2's "one core, many lenses" now holds for every board.
7. **Card anatomy: checklists, attachments, comments/activity, custom fields, labels UI** (P1, M).
8. **Column management UI + grouping/swimlanes + table power features** (P1, M).
9. **CV: server-side PDF, versions/variants, split-screen editor, imports** (P1, L) — the Phase 3
   acceptance criterion ("ATS-safe PDF in under 3 minutes") is not currently demonstrable.
10. **AI career assist: bullet rewrite, JD tailoring, keyword gap, cover letter, per-change diff**
    (P1, M) — approval-gated, never inventing facts, extending the existing eval suite.
11. **Offer comparison with weighted scoring + FX; company records page** (P1, M).
12. **Notes: markdown editor with slash commands, templates, per-entry encryption** (P1, M).
13. **Dashboard completeness: widget resize, the missing widgets, KPI sparkline/definition tooltip,
    `/analytics`** (P1, M).
14. **Keyboard: remappable shortcuts + `/settings/shortcuts`, the missing bindings, vim mode** (P2, M).
15. **Habit schedules (RRULE) + yearly heatmap + freeze UI; finance FX + CSV import; focus reports;
    learning highlights/queue** (P2, M).
16. **Marketing routes `/privacy`, `/terms`, `/changelog`; `/settings/notifications`; `docs/MCP.md`;
    the keyboard walkthrough** (P2, S).
17. **Auth hardening: TOTP 2FA, passkeys, magic link, session list** (P2, M).
18. **Ops: pino logging; the Vercel preview deploy** (P2, S + credentials).

## Definition of done (§16) — current standing

Not yet done. Green: CI, checks, a11y/Lighthouse/load evidence, and a tagged v0.1.0. Not done: the
Vercel preview deploy (no credentials), the §16 feature checklist and prioritized backlog (this
file now supplies them), and the demo path — with items 1–5 above standing between the current build
and "a new user can sign up, build and export a CV, connect an AI agent over MCP and get a daily
brief, all on the free plan".
