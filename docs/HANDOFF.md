# Handoff — LifeOS in Phase 5

Read `AGENTS.md` and `prompt.md` first; this file records **state, outstanding gaps and gotchas**,
not decisions (those are in `docs/DECISIONS.md`).

## Status

- Phases 0–4 complete and reported. **Phase 5 in progress** (API, MCP, webhooks, docs).
- Last verified gate (clean tree): `typecheck` · `lint` · `format:check` · `build` ✓ ·
  `pnpm test` **219 passed** ✓ · `pnpm e2e` **45 passed, twice** ✓.
- ADR-044 … ADR-065 record the decisions. Nothing is pushed; all work is on local `master`.

## Phase 5 so far

- `api_keys` table (migration 0008) + `src/server/api-keys`: `lifeos_live_<prefix>_<secret>` tokens,
  SHA-256 hash + prefix, scopes, expiry, last-used, soft revoke (ADR-062).
- `/settings/integrations` management UI: create (token shown once), list, revoke.
- REST `/api/v1/cards` (+ `/[id]`): GET list with opaque cursor pagination and sparse `?fields=`,
  POST create with Idempotency-Key, GET/PATCH (If-Match ETag) /DELETE, Bearer-key or session auth,
  per-actor rate limit, the shared `{ error: { code, message, details, request_id } }` shape
  (ADR-063).
- MCP server `/api/mcp` (Streamable HTTP, stateless JSON responses): tools `search`, `create_card`,
  `move_card`, `get_daily_brief`, Bearer-key scopes, Origin guard (ADR-064).
- `POST /api/v1/ingest` for Shortcuts/automations, reusing the capture grammar, with the recipe in
  `docs/INGEST.md` (ADR-065).
- Next in phase: outgoing webhooks, OpenAPI 3.1 + `/docs/api`, the cross-tenant isolation suite for
  both new surfaces.

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

1. **i18n is incremental** (ADR-053/060): `/about` and the shell chrome (nav + tagline) are
   translated (en/bn); page bodies, the status-line hints and the `?` cheat-sheet are still
   English — the same mechanical pass, to be done surface by surface. This is the only open
   Phase-4 backlog item.

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
