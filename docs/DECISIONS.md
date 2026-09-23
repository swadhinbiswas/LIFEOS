# docs/DECISIONS.md — Architecture Decision Records (append-only)

> ADR log for LifeOS, required by `prompt.md` §1 and `AGENTS.md`: **every non-obvious decision
> gets an entry here before the code that implements it.** Format: Context → Decision →
> Consequences, with sources. Append new entries at the bottom with the next number; never
> rewrite history — supersede with a new entry that references the old one.
>
> Numbering: `ADR-NNN`. Status: `accepted` (default) | `proposed` | `superseded by ADR-XXX`.

---

## ADR-001 — Phase 0 gate: research before any app code

- **Status:** accepted (2026-09-23)
- **Context:** Spec §1 (research gate) and §14 Phase 0 forbid app code until `docs/RESEARCH.md`
  exists; the repo had only `prompt.md` + 12 screenshots and zero commits.
- **Decision:** Phase 0 produces `docs/RESEARCH.md` (a–g), `docs/ERD.md`, this file,
  `docs/MVP-SCOPE.md`, and `docs/research/github-swadhinbiswas.json` before any `src/` exists.
- **Consequences:** Phase 1 scaffolding starts from verified pins and a fixed ERD; no code to
  rip out. Cost: the phase itself.

## ADR-002 — Reference product: NexaCRM is study-only (commercial license)

- **Status:** accepted (2026-09-23)
- **Context:** NexaCRM (`shadcnstudio.com/templates/admin-dashboard/nexacrm`, $79, created
  2026-08-14) is the design reference. Its license page (`shadcnstudio.com/license`, updated
  2026-01-13): templates are paid resources; free components are "MIT + Commons Clause" — no
  sale, redistribution, or competing products.
- **Decision:** LifeOS copies **measurements and design ideas only** (recorded in
  `RESEARCH.md` §a: 16rem sidebar, 0.45rem radius, 44–45px rows, Manrope, `?view=` switcher,
  KPI anatomy, settings IA). **No NexaCRM source code is read into the repo or reproduced.**
  LifeOS re-implements from scratch with its own TUI tokens (§3 of the spec diverges:
  radius none, 28–32px rows, monospace chrome).
- **Consequences:** license risk neutralized; visual parity at the *craft* level without source
  coupling; every UI file is original so no provenance questions arise.

## ADR-003 — Stack pins verified from the npm registry (2026-09-23)

- **Status:** accepted (2026-09-23) — re-verify at install time
- **Context:** Spec §1 requires pinning exact versions from live docs, not memory.
- **Decision:** Phase 1 scaffolds **Next 16.3.6, React 19.3.0, TypeScript (see ADR-004),
  Tailwind 4.3.3, shadcn 4.21.0, Drizzle 0.45.3 (ADR-005), @libsql/client 0.18.0,
  Better Auth 1.7.5 + @better-auth/drizzle-adapter 1.7.5 (ADR-006), TanStack Query 5.103.2,
  TanStack Table 9.2.4, zustand 5.0.15, nuqs 2.10.1, RHF 7.88.0, zod 4.6.5, dnd-kit 6.3.1,
  fractional-indexing 4.0.0, recharts 3.10.1, Upstash redis 1.39.0 / ratelimit 2.2.0 /
  qstash 2.11.3, AI SDK 7.0.112 (ADR-007), MCP SDK 1.30.0 (ADR-010), chrono-node 2.10.1,
  rrule 2.8.1, vitest 5.0.1, playwright 1.63.0, axe 4.13.0, eslint 10.11.0, prettier 3.9.9`**,
  full table in `RESEARCH.md` §e.
- **Consequences:** reproducible installs; risk register in §e flags majors that need an early
  spike (TypeScript 7, TanStack Table v9, eslint 10, vitest 5). Any version bump after this
  date gets its own ADR.

## ADR-004 — TypeScript version: evaluate at Phase 1, pin then

- **Status:** accepted (2026-09-23)
- **Context:** npm `typescript` latest is **7.0.2** (the native line) as of 2026-09-23 — a
  brand-new major. ESLint 10 and vitest 5 are also recent majors. Spec asks for strict TS.
- **Decision:** At Phase 1, run the scaffold against **TS 7.0.2 first**; if `next build`,
  eslint (`typescript-eslint`) or vitest fail on it within a short spike, fall back to the
  newest TS 5.x/6.x that Next 16 documents, and record the outcome here as ADR-004b.
  `strict: true` either way.
- **Consequences:** we don't build the whole app on an unproven toolchain, and we don't
  silently default to stale versions; one explicit checkpoint instead.

## ADR-005 — Database: Turso Cloud (libSQL) + Drizzle stable, not the 1.0 RC

- **Status:** accepted (2026-09-23)
- **Context:** Spec §7.3/§13 require SQLite/libSQL + Drizzle. Drizzle's own docs now banner
  "Upgrade to v1.0 RC" and the Turso guide shows `npm i drizzle-orm@rc`, while the npm
  `dist-tags.latest` for `drizzle-orm` is **0.45.3** (registry, 2026-09-23).
- **Decision:** pin **drizzle-orm 0.45.3 + drizzle-kit 0.31.11 + @libsql/client 0.18.0**
  (stable), connect per the official Turso guide
  (`docs.turso.tech/sdk/ts/orm/drizzle`, `drizzle({ connection: { url, authToken } })`).
  No RC-only APIs in our code. Re-evaluate the 1.0 RC after Phase 4 (scheduled ADR).
  FTS5 (spec's `search_index`) is preloaded on Turso; native vector search is confirmed
  available (`F32_BLOB`) — spec §12's "verify vector support" answered: yes, but semantic
  search stays post-MVP per `MVP-SCOPE.md`.
- **Consequences:** stable toolchain now; a bounded migration spike later; PITR + branching
  (dev branches per `turso db create --from-db`) are free risk-reduction.

## ADR-006 — Auth: Better Auth 1.7 with the Drizzle adapter as a separate package

- **Status:** accepted (2026-09-23)
- **Context:** Spec §10 requires email + GitHub + Google, sessions, OAuth accounts. Better Auth
  v1.7 docs (`better-auth.com/docs/llms.txt`, fetched 2026-09-23) show the Drizzle adapter now
  ships as **`@better-auth/drizzle-adapter`** (1.7.5) — not imported from `better-auth` core —
  and Next.js 16 renamed middleware → **`proxy.ts`** (their Next integration page).
- **Decision:** `better-auth@1.7.5` + `@better-auth/drizzle-adapter@1.7.5` (versions locked
  together), `drizzleAdapter(db, { provider: "sqlite" })`, handler mounted at
  `/api/auth/[...all]` via `toNextJsHandler`, session gate in `proxy.ts` (Next 16 location),
  `getSessionCookie` used **only** for redirect hints (their docs warn it is not a security
  check — real checks via `auth.api.getSession`).
- **Consequences:** auth tables (`users/sessions/accounts/verifications`) follow Better Auth's
  schema with our extensions (§2.1 of ERD); adapter/core version skew is a named test.

## ADR-007 — AI: provider-agnostic AI SDK 7 with approval-gated writes

- **Status:** accepted (2026-09-23)
- **Context:** Spec §8: BYOK or platform key, streaming, tools mirroring the REST/MCP list,
  read-free/write-proposal/destructive-confirm safety, injection defense, evals. AI SDK is at
  **7.0.112** (v7) where `needsApproval` was renamed **`toolApproval`** (deprecated alias still
  works) with `tool-approval-request`/`-response` message parts
  (`ai-sdk.dev/docs/agents/policy-tool-approvals`, fetched 2026-09-23).
- **Decision:** AI SDK 7 `generateText/streamText` + `tool()` with Zod `inputSchema`,
  `toolApproval: "user-approval"` for write tools, `stopWhen: isStepCount(n)` loops, provider
  keys stored **AES-256-GCM envelope-encrypted** and never re-sent to the client (spec §10).
  Destructive tools are never auto-approvable (approval allowlist only for create-task /
  log-habit, per spec §8). MCP client tools use the same approval parts.
- **Consequences:** the AI, REST and MCP surfaces share one service layer + one approval UX;
  eval suite (`evals/`) must cover tool selection (30+ prompts), never-invent-facts CV edits,
  and malicious-JD injection fixtures (spec §8) before Phase 6 acceptance.

## ADR-008 — Identifiers: ULID (spec allowed ULID or cuid2)

- **Status:** accepted (2026-09-23)
- **Context:** Spec §7.3: "text IDs (ulid or cuid2)". ULID (`ulid@3.0.2`) sorts by timestamp;
  cursors on `(user_id, created_at, id)` need no secondary sort index. `@paralleldrive/cuid2`
  (3.3.0) checked as the alternative.
- **Decision:** **ULID** as `id` generator (26-char Crockford base32, lexicographically
  time-sortable, no extra index cost, URL-safe, no PII).
- **Consequences:** pagination and audit ordering get ids for free; if we ever need
  non-time-sortable ids (we don't), revisit. Generator lives in one `lib/id.ts`.

## ADR-009 — Kanban ordering: fractional index (`fractional-indexing@4.0.0`)

- **Status:** accepted (2026-09-23)
- **Context:** Spec §7.3 `position TEXT`; research (d) §1: `generateKeyBetween` / 
  `generateNKeysBetween`, base62 keys sort under SQLite `BINARY`, `localeCompare` pitfall,
  non-atomic compute-then-write needs a UNIQUE + retry, rebalance at ≥128 chars (Atlassian).
- **Decision:** store `position TEXT`; every move is a **one-row UPDATE** with a key generated
  between neighbours; `UNIQUE(board_id, column_id, position)` + service retry on collision;
  ordering SQL always uses native byte comparison (`ORDER BY position` — never
  `localeCompare` in JS); background rebalance job follows the 128/160/254 thresholds.
- **Consequences:** 500-card drags stay O(1) writes (Phase 2 acceptance); key growth is
  bounded by the rebalance job; optimistic UI (ADR-011) updates the cached key the same way.

## ADR-010 — External access: REST /api/v1 + MCP 2026-07-28 + webhooks, one service layer

- **Status:** accepted (2026-09-23)
- **Context:** Spec §9: personal API keys (SHA-256 hashed, scoped, shown once), cursor
  pagination, `Idempotency-Key`, OpenAPI 3.1 from Zod; MCP at `/api/mcp` with
  `readOnlyHint`/`destructiveHint`; outgoing webhooks with HMAC. MCP spec's current version
  (fetched 2026-09-23) is **2026-07-28**, transports = stdio + **Streamable HTTP**
  ("each message is an HTTP POST to a single MCP endpoint"); authorization tutorial is
  **OAuth 2.1** for later. SDK `@modelcontextprotocol/sdk` **1.30.0**.
- **Decision:** all four surfaces (Server Actions, REST, MCP, AI tools) are thin adapters over
  the same service functions and Zod schemas (spec §7.2). MCP uses Streamable HTTP at
  `/api/mcp` pinned to spec 2026-07-28; Bearer API keys first, OAuth 2.1 after (spec §9.2
  sequencing). `Idempotency-Key` stored in Upstash Redis for 24 h. Outgoing webhooks sign with
  HMAC-SHA256 and retry via QStash; Dodo inbound webhooks verify per Dodo docs (HMAC-SHA256,
  Standard Webhooks) + `billing_events.event_id` UNIQUE dedupe (spec §11).
- **Consequences:** one authorization/rate-limit/audit path to test (the two-user isolation
  suite, spec §10) instead of four; spec-version drift is a scheduled re-verify at Phase 5.

## ADR-011 — Optimistic concurrency: `version` integer on cards, 409 on stale write

- **Status:** accepted (2026-09-23)
- **Context:** Research (d) §2: SQLite has no native rowversion (Microsoft EF docs state this
  explicitly), so the token must be application-managed; without it the default is
  last-writer-wins.
- **Decision:** `cards.version INTEGER` (ERD §2.2); mutations send `version`; service does
  `UPDATE … WHERE id=? AND version=?`; 0 rows → **409 conflict** → client rolls back its
  optimistic cache, refetches, shows a conflict toast (rollback+toast UX = our design choice;
  the mechanics follow the TanStack Query guide).
- **Consequences:** drag races surface as one toast instead of silent data loss; every write
  path must plumb `version` through the shared schemas.

## ADR-012 — Seed data: live-fetched GitHub/CV facts win over prompt.md's snapshot

- **Status:** accepted (2026-09-23)
- **Context:** Spec §1 says re-verify; §12 forbids invented data and private emails. Fetched
  2026-09-23: 93 repos (spec said ~84), orgs `nanoLMs/StreamBerryLabs/AetherRavyn` (spec
  mentioned Roast-Lang), repo `lsf` (spec said "ls-f"), X handle conflict
  (`twitter_username: swadh1n` vs profile README/site `swadhin_sh`), LinkedIn
  `in/swadhinbiswas` vs spec's `in/swadh1n`, `user.email = null`, README education
  Apr 2022–Jul 2026 + "needs sponsorship · immediate" (both public).
- **Decision:** `docs/research/github-swadhinbiswas.json` is the seed source of truth; where
  it conflicts with `prompt.md` §12's prose, **the fetched data wins** (discrepancy table in
  `RESEARCH.md` §f). Public profile README + swadhin.cv facts (basics, projects, skills, work,
  education) are seed-eligible because they are publicly displayed; **no email addresses** are
  seeded. All fictional pipeline companies/jobs carry `is_demo=1` + a visible `sample` label
  and are removable in one click. Discrepancies are re-fetched at Phase 8, not trusted forever.
- **Consequences:** no fabricated facts in demo mode; refresh is a manual command (rate-limit
  safe); if upstream changes again, only the JSON changes, not the schema.

## ADR-013 — Billing: Dodo plumbing behind `BILLING_ENABLED=false`; go-live blocked on BD eligibility

- **Status:** accepted (2026-09-23) — **go-live decision deferred to Phase 7**
- **Context:** Spec §11 ships Dodo checkout/portal/webhooks but current policy is "everything
  free and unlimited" with all billing UI hidden unless `BILLING_ENABLED=true`. Dodo's
  merchant-eligibility page (fetched 2026-09-23) does **not** list Bangladesh among countries
  eligible for *new* merchant accounts; Bangladesh appears only in the **grandfather clause**
  for merchants already served before it was added to the prohibited list, and Dodo's own
  guidance is to contact `support@dodopayments.com` before integrating. The operator is in
  Bangladesh (spec §11 note).
- **Decision:** Phase 7 builds the full plumbing (`POST /api/billing/checkout`,
  `GET /api/billing/portal`, `POST /api/webhooks/dodo` via `@dodopayments/nextjs@0.3.9`,
  idempotent `billing_events`, entitlements service that always allows while the flag is off)
  **with test-mode credentials only**. No production Dodo account is opened until Phase 7
  confirms eligibility (support ticket) or an alternate MoR is chosen (candidates: Polar —
  which already sells the NexaCRM template — or a supported-country entity). The UI shows
  nothing billing-related while the flag is off (spec §10: no paywalls/nags).
- **Consequences:** Phase 7 acceptance ("checkout → webhook → entitlement round-trip +
  replay no-op") is achievable in Dodo **test mode** regardless of domicile; real paid launch
  carries an open risk (R1 in `RESEARCH.md`) with a documented contingency; entitlements code
  and tests exist now so flipping the flag later is configuration, not a feature build.

## ADR-014 — Rate limiting: Upstash sliding window, fail-open timeout configured explicitly

- **Status:** accepted (2026-09-23)
- **Context:** Spec §9.1 requires `@upstash/ratelimit` sliding window per key and per IP with
  `X-RateLimit-*`/`Retry-After`. Upstash docs (fetched 2026-09-23) show the SDK's default
  **timeout allows the request through** if Redis is slow (fail-open), and `slidingWindow`'s
  reset time is the window boundary, not the first request.
- **Decision:** `Ratelimit.slidingWindow(n, window)` per API key **and** per IP; set the
  timeout/fail-open behavior explicitly in code (not defaults) and document the choice in
  `docs/SECURITY.md` (Phase 9); auth endpoints additionally use Better Auth's own rate limits.
- **Consequences:** predictable limits with visible headers; the availability-vs-strictness
  tradeoff is an explicit, reviewed setting rather than an SDK default we never looked at.

## ADR-015 — Date parsing: chrono-node for capture, rrule for recurrence, tz stored as UTC

- **Status:** accepted (2026-09-23)
- **Context:** Spec §6.2 natural-language capture; research (d) §6: chrono-node 2.10.1 casual
  parser, `isCertain` flags, known timezone weaknesses (issue #590), no recurrence support;
  spec §12 requires timezone-correct dates (store UTC, render user tz, configurable week start).
- **Decision:** `chrono.casual` parses capture strings **server-side** (single parser, not
  per-browser), emitting a live preview with uncertain tokens highlighted and **click-to-correct**
  (Todoist pattern, research (b) #4); parsed instants stored as integer ms UTC. Recurrence is
  `rrule` (2.8.1) strings in `cards.recurrence`. Week start + tz come from `user_settings`.
- **Consequences:** one parser to test; tz edge cases surface as a correctable preview instead
  of silent wrong dates; no RRULE parsing ever touches chrono.

## ADR-016 — DnD: dnd-kit with KeyboardSensor + explicit move buttons (WCAG 2.5.7/2.1.1)

- **Status:** accepted (2026-09-23)
- **Context:** Research (d) §3: the W3C APG has **no** drag-and-drop pattern; WCAG 2.5.7 (AA)
  requires a single-pointer path for dragging and 2.1.1 requires a keyboard path — meeting
  2.5.7 does not satisfy 2.1.1 (w3c/wcag#2705). dnd-kit's KeyboardSensor is default-on but
  silently disappears if the default `sensors` array is replaced carelessly; announcements
  must use positions ("2 of 5"), not indices; `aria-grabbed` is deprecated.
- **Decision:** `@dnd-kit/core` with the **default sensors (Pointer + Keyboard)** retained, custom
  `accessibility.announcements` using positions, `screenReaderInstructions` kept in sync if keys
  are rebound, no `aria-grabbed`; plus **visible move up/down (and column move) buttons** on
  focus as the non-drag path — the pattern GitHub's Primer and Massachusetts.gov guidance
  prescribe. Buttons call the same `move_card` service as drag, so keyboard, pointer, REST and
  MCP all share one code path.
- **Consequences:** the Phase 2 "golden path by keyboard only" acceptance is satisfied by
  design; axe + manual screen-reader checks pass on the board routes.

## ADR-017 — CV export: ATS-safety measured, never marketed as an "ATS score"

- **Status:** accepted (2026-09-23)
- **Context:** Research (d) §4: Greenhouse documents the real parse-failure modes (tables,
  columns, header/footer contact info, >2.5MB, letter-spacing); Greenhouse states its AI
  "doesn't score or rank applications"; third-party "80% match" numbers are proprietary
  marketing. Spec §7 requires selectable, ATS-parsable PDF and §11 warns against misleading UI.
- **Decision:** the CV pipeline stores **JSON Resume 1.0.0** data (`@jsonresume/schema` 1.3.1)
  and renders single-column, standard-heading templates. What the UI shows is: **(1) a
  parse-fidelity score** (round-trip export → extract → diff against source JSON), **(2) a
  layout-risk checklist** (tables/columns/header-footer/graphics booleans, each with its
  Greenhouse/Indeed citation), and **(3) keyword coverage vs the pasted JD** labelled as
  coverage — the string "ATS score" is never used as a quality claim. Export backend
  (`@react-pdf/renderer` vs Playwright HTML→PDF) is decided by a Phase 3 spike against Vercel
  limits + the round-trip test (risk R10).
- **Consequences:** honest, testable quality gate; the fixture suite from Phase 3 doubles as
  the regression test for both export backends.

## ADR-018 — Repo hygiene: conventional commits, no secrets, docs before code

- **Status:** accepted (2026-09-23)
- **Context:** Spec §1 (small conventional commits, `.env` never committed, `.env.example`
  key-only, security not optional) and `AGENTS.md`.
- **Decision:** `husky` + `lint-staged` + `@commitlint` (conventional) run from Phase 1;
  `.env*` gitignored except `.env.example`; CI runs
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build` plus the phase's browser checks;
  each phase ends with a conventional commit + status report before the next phase starts.
- **Consequences:** the phase gate (spec §14) is enforced mechanically; history stays
  reviewable.

---

### Appendix — deferred/scheduled ADRs

| Will be written | When |
| --- | --- |
| ADR-004b: TypeScript fallback outcome | Phase 1, immediately after the TS spike |
| Drizzle 1.0 RC migration (or "stay on 0.x") | after Phase 4, per ADR-005 |
| Dodo go-live / alternate MoR | Phase 7, per ADR-013 (risk R1) |
| PDF export backend (react-pdf vs Playwright) | Phase 3 spike, per ADR-017 |
| Vector/semantic search activation | post-MVP (see `MVP-SCOPE.md`) |
| OAuth 2.1 for MCP (after Bearer keys) | after Phase 5, per ADR-010 |
