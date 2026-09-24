# Handoff — LifeOS state after Phase 3 chunk 4

Written at the end of a very long single session. Read `AGENTS.md` and `prompt.md` first; this
file records **state and the one open debugging problem**, not decisions (those are in
`docs/DECISIONS.md`).

## Status

- Phases 0, 1 and 2 are complete and reported. Phase 3 is in progress, chunks 1–4 committed:
  - `43bc62d` career schema on the board engine (ADR-044)
  - `6e73508` job pipeline service + funnel analytics (5 integration tests, funnel pinned by fixture)
  - `f35b471` `/career/jobs` on the shared `BoardView` + nav + axe coverage
  - `e613509` `/career/analytics` over the derived funnel + nav + axe coverage
- Last verified gate (clean tree at `e613509`): `pnpm typecheck && pnpm lint && pnpm format:check`
  ✓ · `pnpm test` **113 passed** ✓ · `pnpm build` ✓ · `pnpm e2e` **17 passed** ✓.
- Nothing is pushed; all work is on local `master`.

## The one open problem: board undo/redo (Ctrl+Z) is not shipped

Spec §6.1 requires an undo/redo stack (last 50 board actions). Three attempts; the first two
were reverted, and the third was reverted too. **Everything below is evidence, not theory:**

- The **foundation is committed** (`217c087`): `src/server/boards/revert.ts` (`revertMove`,
  `revertUpdate` — they take _intent_, not a version, and read the current version server-side),
  `src/app/(app)/_components/board/board-history.ts` (Zustand store outside React/query cache:
  `record` / `take` / `settle`, cap 50), `src/app/(app)/_components/board/use-undo-redo.ts`
  (applies an entry through those actions, invalidates `["board", id]` + `["trash"]`), plus
  `src/server/boards/revert.test.ts` (2 integration tests, passing).
- What is **not** committed is the UI wiring: recording entries from the four mutations,
  `Ctrl+Z` / `Ctrl+Shift+Z` in `use-board-keys.ts`, the history buttons in `board-view.tsx`,
  and a `Ctrl+Z` row in `config/shortcuts.ts`.
- **Symptom, reproduced three times:** the undo/redo e2e passes repeatedly when the spec runs
  alone (`pnpm exec playwright test tests/e2e/boards.spec.ts` → green, twice in a row) but
  **fails only in the full suite** (`pnpm e2e` → 1 failed, 17 passed, always
  `tests/e2e/boards.spec.ts:252` "undo/redo: Ctrl+Z reverses a move and Ctrl+Shift+Z replays
  it"). Failing assertion in the full-suite runs: the card is not in the expected column after
  the key press.
- Attempts and what each ruled out:
  1. Stacks in hook refs, replayed through the optimistic mutations → recursed (an undo recorded
     a new undo) and raced settle-refetches. Reverted → foundation redesign (above).
  2. Record on mutation **success** → an immediate `Ctrl+Z` could target an _older_ entry under
     suite load. Reverted.
  3. Record **optimistically** in `onMutate` with `drop` on error, **and** gate card controls
     until the id is server-confirmed (`hidden={card.id.startsWith("pending-")}` in
     `card-tile.tsx`) so no action can reference a temporary id. Still failed only in the full
     suite. Reverted.

**Next debugging step (do this first, with fresh context):** run
`pnpm exec playwright test tests/e2e/boards.spec.ts --repeat-each=3` and then
`pnpm e2e --trace on`, open the trace of the failing full-suite run, and look at what the undo
press actually did — the trace will show whether the key event reached the handler, which
history entry was taken, and whether the reversal action returned an error. Also check whether
other specs leave _server-side_ state that matters (each test has its own browser context, so
client state cannot leak; a server-side cause is the more likely one). Candidates worth ruling
out explicitly: the a11y spec runs `/tasks` under six presets before this spec (theme cookie is
per-context, but the _boards_ it creates for its user are not shared — verify no global keydown
handler conflict between `app-shell.tsx`, `global-keyboard.tsx` and `use-board-keys.ts`).

Do **not** ship the wiring until `pnpm e2e` is green twice in a row; a flaky undo is worse than a
missing one, and this repo treats red gates as blocking.

## Remaining Phase 3 work

1. **Job detail + job-specific card faces** (chunk 5, not started):
   - Join company/excitement/source into the board payload for the job board and show them on
     the tile (the tasks board passes nothing, so keep it an optional prop on `BoardView`).
   - `/career/jobs/[id]`: application fields, interview log (`interviews`), offer comparison
     (`offers`), contacts, `resume_id` wiring.
2. **Analytics depth**: source and resume-version breakdowns, applications/week vs goal,
   ghosted detection (all derived from `stage_history`; `getFunnel` in
   `src/server/career/index.ts` is the pattern to follow).
3. **CV builder**: `/career/cv` library + versions, `/career/cv/[id]/edit`, `/career/cv/[id]/preview`,
   ATS-safety check (ADR-017: measured, never marketed as a score), PDF/DOCX/JSON export.
4. **Growth + prep**: skills matrix, achievements/brag doc, portfolio (GitHub import from
   `docs/research/github-swadhinbiswas.json`), question bank, STAR stories.
5. **Phase 3 acceptance**: a job can be added in <10s, a targeted ATS-safe PDF in <3min, funnel
   analytics verified against fixtures (already true at service level), axe on every new route,
   then the phase gate + status report.

## Conventions that bit me (worth remembering)

- Tests must select the **server-confirmed** card (`[data-card-id]:not([data-card-id^="pending-"])`);
  optimistic rows have temporary ids.
- While a Radix modal is open the rest of the page is `aria-hidden`, so role-based locators
  cannot see the board — address board elements by attribute (`data-column-name`, `data-slot`).
- axe cannot resolve Tailwind's `color-mix` opacity modifiers and reports false contrast
  failures (ADR-041): controls that axe scans use plain token colours.
- Commit bodies go through zsh: backticks and `!` in a `-m` string get interpreted. Single-quote
  the body.
