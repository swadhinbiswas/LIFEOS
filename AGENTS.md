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
   - Current phase: **8 → complete** (seed generated from the research file with profiles, the
     three-step `/onboarding` on `users.onboarded_at`, the template gallery, the public TUI-hero
     landing and a no-account read-only `/demo`, and the in-app `/docs` site. ADR-080…087; gate
     green: 271 unit + 9 evals, 57 e2e twice, build, typecheck, lint). Next: **Phase 9 (hardening
     and release), awaiting go-ahead**.

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

The standing gate for every chunk is:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

plus `pnpm e2e` (Playwright, includes the axe sweep) for anything that touches a route. Each phase
ends with: run the gate → commit (conventional format, e.g. `feat(boards): …`) → print a short
status report.

## Conventions

- Conventional Commits; small, reviewable commits.
- Feature-first structure under `src/` with a single service layer (spec §7.2): Server Actions,
  REST `/api/v1`, MCP `/api/mcp` and AI tools are thin adapters over the same Zod schemas.
- Every non-obvious decision → `docs/DECISIONS.md` entry (context, decision, consequences).
- When this file and `prompt.md` ever disagree, **`prompt.md` wins**; fix this file.
