# Handoff — LifeOS in Phase 6

Read `AGENTS.md` and `prompt.md` first; this file records **state, outstanding gaps and gotchas**,
not decisions (those are in `docs/DECISIONS.md`).

## Status

- Phases 0–5 complete and reported. **Phase 6 complete** (AI copilot); awaiting the user's go-ahead
  for Phase 7 (billing scaffold, settings, data ownership).
- Last verified gate (clean tree): `typecheck` · `lint` · `format:check` · `build` ✓ ·
  `pnpm test` **252 passed** ✓ · `pnpm eval` **9 passed, thresholds 100 %** ✓ ·
  `pnpm e2e` **48 passed, twice** ✓.
- ADR-044 … ADR-078 record the decisions. Nothing is pushed; all work is on local `master`.

## Phase 6 — AI copilot (complete)

- Foundation: AI env contract, AES-256-GCM at-rest helper with a documented dev/test fallback,
  `ai_credentials`/`ai_conversations`/`ai_messages`/`ai_usage`/`ai_memories` + `audit_log`
  (migration 0011), the credential store (encrypted, masked, tenant-scoped), audit and usage
  services, and AI prefs on `user_settings` (ADR-073/074).
- Safety: a pure tool catalogue and the single `approvalFor` policy — read free, write proposes,
  destructive never auto-approvable, unknown denied (ADR-076/078).
- Tools: all 28 §8 tool adapters over the shared services (ADR-076).
- Runtime: `agent.ts` attaches the policy, wraps untrusted content, streams with a step cap and
  usage callback; `providers.ts` resolves BYO → platform → scripted (`AI_SCRIPTED`) and the scripted
  model is a real `LanguageModelV4` (ADR-075).
- Endpoint: `POST /api/ai/chat` — session auth, budget cap, signed approvals
  (`TOOL_APPROVAL_SECRET`), conversation persistence (upsert, approval-safe).
- UI: `/ai` full page, Ctrl/Cmd+J slide-over, palette “Ask AI…”, contextual buttons (Plan my day,
  Summarize board), one-key approve (y) / reject (n); `/settings/ai` for provider, model, key,
  auto-approve allowlist, memory and usage. All translated (en/bn), 878/878 keys.
- Evals: `pnpm eval` — 32 tool-selection prompts, 3 injection fixtures, CV no-invention checker.
- e2e: `tests/e2e/copilot.spec.ts` exercises propose → approve → reject against the scripted model.
- Gotcha: the E2E harness sets `AI_SCRIPTED=true` plus a fixed `AI_ENCRYPTION_KEY` and
  `TOOL_APPROVAL_SECRET` in `tests/e2e/global-setup.ts`; a production build without a provider key
  shows the honest “configure a provider” state instead of a dead chat box.

## Phase 5 so far

- `api_keys` table (migration 0008) + `src/server/api-keys`: `lifeos_live_<prefix>_<secret>` tokens,
  SHA-256 hash + prefix, scopes, expiry, last-used, soft revoke (ADR-062).
- `/settings/integrations` management UI: create (token shown once), list, revoke.
- REST `/api/v1/cards` (+ `/[id]`): GET list with opaque cursor pagination and sparse `?fields=`,
  POST create with Idempotency-Key, GET/PATCH (If-Match ETag) /DELETE, Bearer-key or session auth,
  per-actor rate limit, the shared `{ error: { code, message, details, request_id } }` shape
  (ADR-063).
- REST coverage for every module through a **resource registry** (ADR-070): jobs, notes, habits
  (+logs), goals, accounts, transactions, subscriptions, health, courses, books, reviews,
  notifications via `/api/v1/[resource]` (+`/[id]`), plus static `/focus/sessions`, `/settings`.
- MCP server `/api/mcp` (Streamable HTTP, stateless JSON responses): tools `search`, `create_card`,
  `move_card`, `get_daily_brief`, **resources** (`lifeos://brief`, card/note templates) and
  **prompts** (`daily-plan`, `job-follow-up`, `weekly-review`), Bearer-key scopes, Origin guard
  (ADR-064/071). Compatibility is proven by an acceptance test using the official
  `@modelcontextprotocol/sdk` client (dev-only).
- `POST /api/v1/ingest` for Shortcuts/automations, reusing the capture grammar, with the recipe in
  `docs/INGEST.md` (ADR-065).
- Outgoing webhooks (`webhooks_out` + `webhook_deliveries`, migrations 0009/0010): HMAC-signed
  deliveries emitted best-effort from the board/notes/habits/career services, **retried on an
  exponential backoff** (60s/5m/30m/2h/6h, six attempts) by a sweep that the `CRON_SECRET`-guarded
  `/api/cron/webhooks` route or the integrations page runs, with a replayable log and a panel in
  `/settings/integrations` (ADR-066/069).
- OpenAPI 3.1 generated from the route Zod schemas at `/api/v1/openapi.json`, with a themed
  server-rendered reference at `/docs/api` (ADR-067).
- Two-user isolation suite across the REST and MCP surfaces, plus an MCP wire-level acceptance e2e
  (initialize → tools/list → the four tools → the moved card live on the board) (ADR-068).
- The i18n backlog (ADR-072) is complete: every authenticated surface — chrome, auth pages,
  `/about`, dashboard, trash, inbox, health, learning, calendar, reviews, focus, goals, habits,
  notes, finance, settings, appearance, integrations, `docs/api`, tasks, boards, the whole board
  surface and the career pages (jobs, analytics, portfolio, interview prep), plus the command
  palette, shell chrome and the status line — reads from the catalog in en/bn. English values are
  byte-identical to the previous literals, so the tests and axe pass hold. Operation summaries in
  the OpenAPI document and server-provided enum values stay English by design.
- Next: the Phase 5 acceptance/report.

## The Phase-4 chunks

- `217c087` board undo/redo **foundation** (service + store; UI not shipped — see gap 1)
- `43bc62d` career schema · `6e73508` job pipeline · `f35b471` jobs page · `e613509` analytics
- `7a0603c` source/week/ghosted analytics · `a01fc02` portfolio · `432f0ec` skills/brag ·
  `0675427` interview prep
- `b1ab7f5` life schema (ADR-045) · `a769a77` habits · `b00c4d9` goals · `f6b7b04`+`5c7d99b`
  notes FTS/wiki · `f233d92` notes UI · `d168446` focus timer · `6ed49aa` finance · `48b30ea`
  health · `5d6b33b` learning · `7a6d521` dashboard KPIs · `6cfdbc9` reviews
- `e88fa0a` dashboard widget variants (ADR-046) · `edbda4f` ambient status-line timer
- `55b916f` notification centre (ADR-047) · `fafef28` cross-module trash (ADR-048)
- `1ab114c` tags on notes + card→goal links (ADR-049) · `cf3f0ad` subscriptions (ADR-050)
- `91721ac` offline quick-capture queue (ADR-051) · `97e7e41` calendar (ADR-052)
- `d286561` i18n scaffold (ADR-053)
- undo/redo shipped: Ctrl+Z / Ctrl+Shift+Z over the version-free reversal actions (spec §6.1)
- per-card reminders delivered by the notification sweep (ADR-054)
- PWA: installable manifest + network-first shell cache (ADR-055)
- card↔card links from the card sheet (ADR-056)
- timezone preference + day bucketing in the user's zone (ADR-057)
- configurable week start for every "this week" number (ADR-058)
- cross-module tags on cards, distinct from board labels (ADR-059)
- shell chrome translated: navigation labels + tagline (ADR-060)
- career analytics week buckets follow the user's week (ADR-061)

## Outstanding gaps (deliberate, with next steps)

1. **i18n is complete for en/bn** (ADR-053/060/072): every authenticated page body, its client
   components, the command palette, the shell chrome and the status line read from the catalog.
   Two boundaries are deliberate: OpenAPI operation summaries (the machine-readable document) and
   server-provided enum values (card/priorities, interview round kinds, difficulty levels) stay
   English. No open backlog item remains here.

## Next: Phase 5 (awaiting the user's go-ahead)

REST `/api/v1` (cursor pagination, sparse fields, ETag/If-Match, Idempotency-Key, error shape),
personal API keys (hashed), MCP server `/api/mcp` + "Connect an AI agent", `/api/v1/ingest` +
Shortcut docs, outgoing webhooks (HMAC), OpenAPI 3.1 + themed `/docs/api`. Also #31: the two-user
tenant-isolation suite starts here and grows each phase. Confirm the phase's tech-debt check before
starting.

## Test-harness gotchas (learned the hard way)

- Integration tests each own a DB file, and the name must be **unique per process**
  (`.data/<x>-int-${process.pid}.db`): vitest collects and runs a file in separate processes, and a
  shared name races the first DDL into `SQLITE_BUSY`. (Trash/tags/calendar tests do this.)
- Tests select the **server-confirmed** card (`[data-card-id]:not([data-card-id^="pending-"])`);
  optimistic rows carry temporary ids.
- While a Radix modal is open the rest of the page is `aria-hidden`, so role-based locators cannot
  see the board — address board elements by attribute (`data-column-name`, `data-slot`).
- axe cannot resolve Tailwind's `color-mix` opacity modifiers and reports false contrast failures
  (ADR-041): controls axe scans use plain token colours.
- Commit bodies go through zsh + commitlint: **single-quote the body and keep lines ≤ 100 chars**
  (easiest: `git commit -F -` with a quoted heredoc).
- The keyboard cheat-sheet test asserts unimplemented destinations are **not** advertised — adding
  a `g`-binding means updating `tests/e2e/keyboard.spec.ts`.
