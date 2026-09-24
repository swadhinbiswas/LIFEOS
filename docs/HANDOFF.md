# Handoff — LifeOS after Phase 4

Read `AGENTS.md` and `prompt.md` first; this file records **state, outstanding gaps and gotchas**,
not decisions (those are in `docs/DECISIONS.md`).

## Status

- Phases 0–3 complete and reported. **Phase 4 complete** (dashboards + life modules).
- Last verified gate (clean tree at `d286561`): `typecheck` · `lint` · `format:check` · `build` ✓ ·
  `pnpm test` **196 passed** ✓ · `pnpm e2e` **37 passed, twice** ✓.
- ADR-044 … ADR-053 record the phase's decisions. Nothing is pushed; all work is on local `master`.

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

## Outstanding gaps (deliberate, with next steps)

1. **Board undo/redo (Ctrl+Z) is still not shipped.** The foundation is committed (`217c087`):
   `src/server/boards/revert.ts`, `board-history.ts`, `use-undo-redo.ts` + passing `revert.test.ts`.
   The UI wiring (record from the four mutations, Ctrl+Z/Ctrl+Shift+Z in `use-board-keys.ts`,
   history buttons in `board-view.tsx`, a `Ctrl+Z` row in `config/shortcuts.ts`) was attempted and
   reverted three times over a flake that appears **only in the full e2e suite**. Next step, with
   fresh context: `pnpm exec playwright test tests/e2e/boards.spec.ts --repeat-each=3`, then
   `pnpm e2e --trace on`, open the failing trace. Do **not** ship until `pnpm e2e` is green twice.
2. **PWA installability + offline read cache** are deferred (ADR-051); offline **capture** syncs,
   which is the phase-acceptance item.
3. **i18n is a scaffold** (ADR-053): `/about` is translated (en/bn) with a cookie locale; the shell
   is English. Translated pathnames and a per-user locale setting are pending.
4. **The `reminders` table is unwired** — ADR-050 sends subscription renewal nudges through the
   notification sweep instead. An explicit per-entity "remind me at" UI is a future chunk.
5. **Generic tags apply to notes only** (ADR-049); cards keep their board-scoped labels.
   `card_links` (card↔card) is unwired.
6. **Dates are UTC everywhere** (ADR-045/052/053); per-user timezone rendering is the open §6.9
   timezone item.

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
