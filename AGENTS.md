# AGENTS.md — Working agreement for this repository

This repo is **LifeOS**: a free, open, AI-connected personal operating system (Kanban/tasks,
career/CV, habits, notes, finance) rendered as a keyboard-first, TUI-skinned web app.

## Read this first, every time

1. **`prompt.md` is the single source of truth** for product, stack, design system, phases and
   acceptance criteria. Read it fully before changing anything. Its **section 1 operating rules
   bind every agent working here** — research before code, verify docs over memory, no fabricated
   data, no placeholder UI, small conventional commits, keep `docs/DECISIONS.md` updated, security
   is not optional, never commit secrets, ask only when genuinely blocked.
2. **Phase gate:** do not start phase N+1 until phase N's checks pass and a status report has been
   given to the user. The user asked to stop at each phase boundary and report.
   - Current phase: **9 → complete** (hardening and release): `docs/{ARCHITECTURE,SECURITY,
SELF_HOSTING,RELEASE}.md`, CHANGELOG, Dockerfile, `/api/health`, dependabot + audit CI,
     Lighthouse config, a load-test script (ran at 1419 req/s, p95 26 ms). Gate green: 271 unit +
     9 evals, 57 e2e, build, typecheck, lint. Tagged **v0.1.0** locally. Next: v1.1 backlog
     (docs/RELEASE.md + CHANGELOG list the open items).

## Repository map

| Path                                      | Purpose                                                                                                                                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt.md`                               | Full spec (17 sections). Never edit without being asked.                                                                                                                                        |
| `docs/RESEARCH.md`                        | Phase 0 research: NexaCRM measurements, competitor teardown, TUI study, best practices, library verification, seed research, vendor findings, open risks.                                       |
| `docs/ERD.md`                             | Entity-relationship model derived from spec §7.3.                                                                                                                                               |
| `docs/DECISIONS.md`                       | Append-only ADR log. Every non-obvious choice gets an entry **before** the code that implements it.                                                                                             |
| `docs/MVP-SCOPE.md`                       | The MVP cut-list: what ships, what is deferred, what is excluded.                                                                                                                               |
| `docs/research/github-swadhinbiswas.json` | Raw seed research (fetched GitHub API data + profile README, with `fetched_at`). Refresh, don't trust forever.                                                                                  |
| `docs/reference/`                         | NexaCRM reference screenshots (study only — see license note below).                                                                                                                            |
| `src/`                                    | The app: feature-first `src/server/<module>` services (single writer per table), `src/app/(app)/<route>` pages, `src/config` (nav, shortcuts, themes, registries), `src/lib`, `src/components`. |

## Hard rules (extracted from spec §1, §10, §12)

- **Research gate:** app code may not start until `docs/RESEARCH.md` exists (satisfied for Phase 0).
- **Verify, don't recall:** open official docs at build time, pin exact versions in `package.json`.
  The version table in `docs/RESEARCH.md` §e is a Phase-0 snapshot — re-check at install time.
- **No invented facts anywhere**, especially seed/demo data: everything traces to
  `docs/research/github-swadhinbiswas.json` or is visibly labelled `sample`. Never put the
  profile's private contact details in seed data.
- **No placeholders in shipped UI:** no lorem ipsum, no dead buttons, no TODO screens; hide
  out-of-phase features entirely instead of stubbing them.
- **License:** the NexaCRM template is a commercial Shadcn Studio product. Measurements and
  design ideas may be studied; source code must not be copied. LifeOS re-implements from scratch.
- **Security:** tenant-scoped queries in every service call, hashed API keys, Zod at every
  boundary, sanitized markdown, rate limits, secrets only via env, `BILLING_ENABLED=false`
  hides all billing UI.
- **Secrets:** `.env` is never committed; `.env.example` documents keys without values.

## Commands

### The gate is tiered — match it to the blast radius

Running everything after every edit is not diligence, it is latency: a full round is several minutes
of waiting and it trains the reviewer to ignore the output. What matters is that a change is verified
_in proportion to what it can break_, and that anything genuinely at risk is actually covered.

**Always, on every edit** — these are seconds, not minutes:

```bash
pnpm typecheck && pnpm format:check
```

**When the change touches a `.css` file:** nothing else in the gate can see a stylesheet. `prettier`
does not reformat comment prose, `format:check` passes, and `pnpm build` prints "Compiled
successfully" from a warm cache without compiling. A comment block split by a mis-anchored edit sat
in `globals.css` through a full green gate and only surfaced in the dev server. `pnpm test` now
compiles every stylesheet with the same compiler Next uses (`src/app/globals-css.test.ts`) — but note
that `postcss.parse` is **not** a substitute; it accepted the broken file.

**When the change touches logic, a service, a schema, or a boundary:**

```bash
pnpm lint && pnpm test        # 643 unit tests, ~20s
```

**When the change touches a route, a component the specs drive, or an auth/env path:** run the specs
that cover _those_ routes, not the sweep.

```bash
pnpm exec playwright test --config=playwright.local.ts tests/e2e/boards.spec.ts
```

Match the spec to the change. Fixing the inbox does not require re-running the career suite. If a
spec file does not exist for what you changed, that is a gap worth filling — not a reason to run the
other eighty.

**Only when asked, at a phase boundary, or before a release:** the full sweep.

```bash
pnpm build && pnpm exec playwright test --config=playwright.local.ts
```

**Never skip a check because a change looks small.** A one-line edit to a query, a role, a cookie or
an env key reaches further than a one-line edit to a class string. The tiering is about _which_
checks, decided by what the change can break — not about skipping verification. If you cannot say
which tier a change falls in, it is the higher one.

Report honestly what was run and what was not. "Unit green, e2e not run" is a useful sentence; a
green tick for a suite that was quietly skipped is a lie.

Each phase ends with: run the gate → commit (conventional format, e.g. `feat(boards): …`) → print a
short status report.

## Conventions

- Conventional Commits; small, reviewable commits.
- Feature-first structure under `src/` with a single service layer (spec §7.2): Server Actions,
  REST `/api/v1`, MCP `/api/mcp` and AI tools are thin adapters over the same Zod schemas.
- Every non-obvious decision → `docs/DECISIONS.md` entry (context, decision, consequences).
- When this file and `prompt.md` ever disagree, **`prompt.md` wins**; fix this file.
