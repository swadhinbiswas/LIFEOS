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
- **Consequences:** license risk neutralized; visual parity at the _craft_ level without source
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
  eligible for _new_ merchant accounts; Bangladesh appears only in the **grandfather clause**
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

## ADR-019 — Package manager: pnpm pinned via `packageManager`; root `package.json` ends the

## up-tree yarn conflict

- **Status:** accepted (2026-09-23)
- **Context:** `pnpm` refused to run inside the repo ("This project is configured to use yarn")
  because it walks up to `/home/swadhin/package.json`, which pins `packageManager: yarn@4.13.0`.
  Installed pnpm here = **9.15.0**; registry latest = 12.6.0 (both verified today). The parent
  file must not be edited (not ours).
- **Decision:** LifeOS gets its own root `package.json` with
  `"packageManager": "pnpm@9.15.0"` matching the installed binary — pnpm stops its upward walk at
  this file, the yarn pin no longer applies. `pnpm-lock.yaml` is committed; CI reads the version
  from `packageManager`. Upgrading to pnpm 12.x is deferred (no benefit now, lockfile churn risk).
- **Consequences:** one toolchain locally and in CI; parent directory untouched.

## ADR-020 — Database: local libSQL `file:` URL until Turso credentials exist (spec §17 fallback)

- **Status:** accepted (2026-09-23)
- **Context:** Phase 1 requires "Drizzle + Turso connection and migrations", but this
  environment has no Turso account/credentials. Spec §17 says: record the blocker, pick a safe
  fallback, keep moving.
- **Decision:** `DATABASE_URL` accepts **`file:.data/lifeos.db`** (dev/test — `@libsql/client`
  local file, same driver as Turso) or **`libsql://…` + `TURSO_AUTH_TOKEN`** (production). One
  Drizzle schema and one drizzle-kit migration set run unchanged against both, because Turso is
  libSQL server over the same client. `.env.example` documents both modes with no values.
  Provisioning a real Turso DB is a deploy-time step recorded in the phase report.
- **Consequences:** the full `db:generate / db:migrate / db:studio` workflow works offline today;
  switching to Turso later is an env-var change only, no code path forks.

## ADR-021 — Upstash: env-gated client with an in-memory dev fallback

- **Status:** accepted (2026-09-23)
- **Context:** Phase 1 lists an "Upstash client"; no `UPSTASH_*` credentials exist here. ADR-014
  already fixed the policy: sliding window, explicit timeout, explicit fail-open.
- **Decision:** `src/server/redis/client.ts` exports the real `@upstash/redis` instance when
  `UPSTASH_REDIS_REST_URL`/`…_TOKEN` are set, otherwise an in-memory Map-backed stub with the
  same interface (dev/self-host only, one boot-time log line). The rate limiter wraps
  `@upstash/ratelimit` sliding window with `timeout` + `failOpen` configured explicitly per
  ADR-014; the stub implements the same window semantics so unit tests cover the logic without
  network. Upstash is never the source of truth (spec §7.1).
- **Consequences:** app boots with zero cloud dependencies locally; behaviour differs only in
  durability, not in API shape.

## ADR-022 — Email: Resend when keyed, dev file-outbox otherwise (keeps verify/reset E2E-testable)

- **Status:** accepted (2026-09-23)
- **Context:** Phase 1 acceptance requires verify-email and reset-password **end-to-end**; no
  `RESEND_API_KEY` exists in this environment.
- **Decision:** one `sendEmail()` port with two transports: (1) **Resend** (`resend` 6.28.1) when
  `RESEND_API_KEY` is present; (2) **dev outbox** otherwise — append
  `{ to, subject, url, at }` JSON to `.data/outbox/` (gitignored) and log the URL server-side.
  Better Auth's `emailVerification` and `forgotPassword` hooks both call this port. The Playwright
  suite reads the newest outbox file and follows the real signed link, so tokens, DB writes and
  route handlers are exercised for real — only the transport differs. Plain template strings for
  the two mails now; React Email templates deferred until a configured mail transport actually
  needs them (verification/reset are the only mail the MVP ships — delivery channels are post-MVP
  per `MVP-SCOPE.md` #61).
- **Consequences:** acceptance criteria testable today; going live = add one env var.

## ADR-023 — OAuth (GitHub/Google): implemented but env-gated; buttons hidden when unconfigured

- **Status:** accepted (2026-09-23)
- **Context:** Phase 1 lists Better Auth with email + GitHub + Google; no OAuth client IDs are
  available here; spec §1 forbids dead buttons/placeholders.
- **Decision:** `socialProviders` are registered only when the matching client id/secret env
  vars are complete, and the auth pages render provider buttons only for providers the server
  reports as configured. With no creds the buttons are simply absent — never stubs. A config-level
  test asserts "provider offered ⇔ env complete". E2E covers the email+password paths, which is
  the exact wording of the Phase 1 acceptance line.
- **Consequences:** no broken sign-in paths ship; adding credentials later enables the feature
  with zero code changes.

## ADR-024 — Theme architecture: `<html data-*>` + cookie first-paint + per-user

## `user_settings.theme_overrides`, and how preset ↔ color-mode resolve

- **Status:** accepted (2026-09-23)
- **Context:** Phase 1 acceptance — _every_ theme and _every_ customizer option updates live and
  survives reload; spec §4.2 ships six single-row palettes (five dark, Paper light), a separate
  color-mode axis, one custom accent, and demands an automated WCAG contrast test; spec §3.3 —
  "persist them per user"; spec §7.1 — Zustand for theme prefs.
- **Decision:**
  - **Source of truth:** `src/config/themes.ts` holds the six preset objects with the exact spec
    hexes plus the option lists for every NexaCRM axis (font, color-mode, radius, content-layout,
    scale, sidebar-variant, sidebar-mode) — a new preset is one object (§4.2).
  - **Application:** attributes on `<html>` (`data-theme`, `data-color-mode`, `data-font`,
    `data-radius`, `data-layout`, `data-scale`, `data-sidebar-variant`, `data-sidebar-mode`,
    `data-accent`) mapped to CSS variables in `globals.css` (Tailwind v4 CSS-first); hover/active/
    muted derived with `color-mix()` per §4.2; custom accent regenerates primary/ring/chart.
  - **Live:** a Zustand store writes the attributes immediately (no reload).
  - **Persistence:** cookie `lifeos-theme` (settings JSON) read by the root layout for
    first paint — no FOUC; signed-in users additionally get `user_settings.theme_overrides`
    (server action on change; cookie hydrated from DB after sign-in). Signed-out visitors keep
    changes in the cookie only.
  - **Preset ↔ mode resolution** (documented interpretation of §4.2, whose palettes are
    fixed-mode): Paper is native-light, the other five native-dark. Selecting a preset sets the
    color mode to its native mode. Selecting color-mode `light` renders Paper; `dark` renders the
    selected dark preset (midnight if the selected preset is Paper); `system` follows the OS
    (dark → selected dark preset, light → Paper), i.e. Midnight/Paper as §4.2 says. Every control
    therefore changes the render deterministically — testable per the acceptance line.
  - **Contrast:** a Vitest suite computes WCAG ratios for the spec's token pairs across all six
    themes; if a listed pair misses AA, the derived token is adjusted and, where a base pair
    itself fails, the hex is nudged minimally and documented here — AA is the hard requirement
    (§4.2/§13).
- **Consequences:** UI, CSS, persistence and tests all read one options matrix; no flash of the
  wrong theme; signed-in users get their theme on every device.

## ADR-025 — Phase 1 surface scope: nav, palette and help ship only implemented targets

- **Status:** accepted (2026-09-23)
- **Context:** spec §1 (no dead UI) + `MVP-SCOPE.md` cut-line rules: boards are Phase 2,
  dashboards Phase 4, AI Phase 6 — but Phase 1 still needs a shell to accept its axe gate.
- **Decision:** `src/config/nav.ts` lists only routes that exist in Phase 1 (Settings → Profile,
  Appearance); later groups are added by their own phase. Signed-in `/` redirects to
  `/settings` (real page; `/dashboard` arrives Phase 4). The command palette skeleton contains
  only commands that work today — navigation, theme/color-mode switching, sidebar toggle, sign
  out; no "Ask AI…" row (Phase 6), no entity search (Phase 2). The `?` help overlay and the
  status-line hints are generated from `config/shortcuts.ts` bindings that are actually active
  (Bubbles rule: disabled bindings self-remove), so help can never advertise a dead key.
- **Consequences:** axe/keyboard passes never touch a stub; each later phase flips its entries
  on in config.

## ADR-026 — Session gate: Next 16 `proxy.ts` + Better Auth `getSessionCookie` for redirects only,

## real `auth.api.getSession` everywhere data is read

- **Status:** accepted (2026-09-23)
- **Context:** Next 16 renamed middleware → `proxy` (official `file-conventions/proxy` docs
  fetched today: "middleware file convention is deprecated"); Better Auth's own docs prescribe
  `getSessionCookie` for redirects and warn it is **not** a security check.
- **Decision:** `src/proxy.ts` redirects cookie-less visitors off `(app)` routes to `/sign-in`
  and signed-in visitors off the auth pages — pure UX, cookie-presence only. Every server
  component/route under `(app)` additionally calls `auth.api.getSession` and re-checks (the
  security boundary, spec §10). Baseline security headers go into `next.config.ts` now; the full
  CSP review is scheduled for the Phase 9 security pass.
- **Consequences:** fast redirects with no DB hit at the edge of every request, and no security
  decision resting on a heuristic cookie check.

## ADR-004b — TypeScript pinned to 6.0.3 (TS 7 blocked by the typescript-eslint peer cap)

- **Status:** accepted (2026-09-23) — fulfils the ADR-004 spike commitment (appended here to
  keep this log append-only)
- **Context:** ADR-004's spike ran twice. (1) `typescript@7.0.2` alone installs and
  strict-compiles a sample tree fine. (2) But
  `npm i -D typescript@7.0.2 typescript-eslint@8.70.1 eslint@10.11.0` fails with
  **`ERESOLVE`**: `typescript-eslint@8.70.1` declares peer `typescript ">=4.8.4 <6.1.0"`
  (verified via `npm view … peerDependencies`), so 7.x is outside the supported range —
  exactly the lint-tooling failure ADR-004 named as the fallback trigger.
  `eslint-config-next@16.3.6` (peer `typescript ">=3.3.1"`) accepts both.
- **Decision:** pin **`typescript@6.0.3`** — the newest release inside typescript-eslint's
  supported range (6.0.2/6.0.3 confirmed on the official registry today). `strict: true`
  plus the rest of the strict set. Revisit TS 7 when typescript-eslint widens its peer range;
  that row moves to the appendix below.
- **Consequences:** typecheck, lint and build all run on one compiler the whole toolchain
  declares support for; TS 7's native-compiler speed is deferred at zero functional cost.

## ADR-027 — Env validation: one Zod schema in `src/env.ts`, key-only `.env.example`

- **Status:** accepted (2026-09-23)
- **Context:** spec §1/§10 (Zod at every boundary, no committed secrets, `.env.example`
  documents keys without values) and the fallback ADRs 020–023, which only work if
  "credential missing" is a first-class, validated state.
- **Decision:** `src/env.ts` exports one Zod schema split into **server vars** (`DATABASE_URL`,
  `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `GITHUB_CLIENT_ID`,
  `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BILLING_ENABLED`) and
  **public vars** (`NEXT_PUBLIC_APP_URL`), plus derived booleans
  (`hasUpstash` / `hasResend` / `hasGithub` / `hasGoogle` / `isCloudDb`) that gate the
  ADR-021/022/023 features. Validation runs once at module load on the server; failure throws
  the readable Zod issue list at boot, never a mid-request stack trace. `.env.example` lists
  every key with an empty value and a one-line comment saying where to get it. CI and E2E
  must pass with the credential-less fallback values (file DB, no Upstash/Resend/OAuth) —
  that is the configuration the acceptance suite actually runs in.
- **Consequences:** one env contract shared by app, tests and E2E; missing creds degrade to
  documented fallbacks instead of crashing; the server/public split keeps secrets out of the
  client bundle.

## ADR-028 — Sidebar semantics: variants flush/inset/floating × modes expanded/icon/full, `[` cycles

- **Status:** accepted (2026-09-23)
- **Context:** the NexaCRM customizer matrix (RESEARCH §a) ships
  `Sidebar Variant: Flush · Inset · Floating` and `Sidebar Mode: Expanded · Icon · Full`, and
  Phase 1 acceptance requires every option to update live and persist. Geometry was never
  pinned down, and "Full" is ambiguous (the reference demo could not be opened — spec §0).
- **Decision:** exact geometry, driven by the same `data-*` attributes as ADR-024:
  - **Mode `expanded`** — 16 rem (256 px, matching NexaCRM's measured sidebar) with icon+label
    rows. **Mode `icon`** — 48 px icon rail; every row keeps an `aria-label` + `title` so
    labels never become unreachable. **Mode `full`** — sidebar leaves the flow entirely
    (content full-width); `[` then opens it as a keyboard-dismissible overlay panel, `[`/`Esc`
    closes it. This is our documented reading of NexaCRM's "Full" option, since only its name
    was captured.
  - **Variant `flush`** — no gap, square against the viewport edge, single border. **Variant
    `inset`** — 8 px gap + rounded corners + border (content visually inset). **Variant
    `floating`** — 12 px gap, rounded, border + shadow, detached card look.
  - **`[` cycles expanded → icon → full → expanded** and persists through the same cookie →
    `user_settings.theme_overrides` path as every other customizer axis; `Esc` closes the
    `full` overlay; all geometry is CSS driven by the data attributes (no layout thrash in JS).
- **Consequences:** one keyboard loop exercises all 9 combinations; the persistence E2E can
  assert each axis independently; later phases inherit the shell unchanged.

## ADR-029 — Test harness: Vitest 5 colocated under `src/`, Playwright 1.63 e2e under `tests/e2e`

## with an isolated DB

- **Status:** accepted (2026-09-23)
- **Context:** Phase 1 explicitly ships the "CI/lint/format/test harness", spec §13 requires
  unit + e2e + axe gates, and the Phase 1 acceptance line (auth E2E, theme persistence, axe on
  shell routes) must be one command away.
- **Decision:**
  - **Unit/component:** Vitest 5.0.1 + `@vitest/coverage-v8`, jsdom environment for component
    tests, files colocated as `src/**/*.test.ts(x)`; `pnpm test` = `vitest run`.
  - **E2E:** Playwright 1.63.0, specs in `tests/e2e/**/*.spec.ts`, `webServer` runs
    `build && start` (prod behaviour), with env overriding `DATABASE_URL` to
    `tests/e2e/.e2e.db` so e2e never touches dev data. Auth flows read the ADR-022 outbox
    file to follow the real signed verify/reset links.
  - **Axe:** `@axe-core/playwright` scans every Phase 1 shell route (sign-in, sign-up,
    forgot/reset/verify, `/settings`, `/settings/appearance`) **across all six presets** (§13
    requires light+dark; six presets is the same loop, run it).
  - **Theme persistence:** toggle each customizer axis live → assert `data-*` changed →
    reload → assert persisted; plus a signed-in round-trip proving cookie ↔ DB hydration.
  - **CI:** job 1 `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`;
    job 2 Playwright with `playwright install --with-deps chromium`.
- **Consequences:** the acceptance suite is executable and repeatable; later phases extend the
  same two runners rather than inventing new ones.

## ADR-030 — Better Auth config: drizzle adapter mapped onto the ERD's snake_case tables with

## integer-ms timestamps; verification required; Upstash secondary storage when present

- **Status:** accepted (2026-09-23)
- **Context:** the ERD (spec §7.3) fixes table/column names (`users`, `sessions`, `accounts`,
  `verifications`, snake_case) and integer-millisecond timestamps, while Better Auth 1.7.5
  defaults to its own camelCase model/column set; adapter docs were fetched today
  (`better-auth.com/docs/concepts/database`, `…/integrations/drizzle`) and must be re-opened
  while writing the config (spec §1: verify docs over memory).
- **Decision:** one `betterAuth()` config using `drizzleAdapter(db, { provider: "sqlite" })`
  with **explicit `modelName`/`field` overrides** mapping every Better Auth model and column
  onto the ERD names, and its number-for-dates option so timestamps land as integer ms (flag
  name to be confirmed against the adapter docs at implementation — noted in code comment).
  `emailAndPassword.enabled`, **`requireEmailVerification: true`** (spec §10 hardening; the
  acceptance flow verifies before sign-in), database `sessions` as source of truth with
  **secondary storage in Upstash only when `hasUpstash`** (ADR-021) for speed (spec §7.1),
  built-in auth rate limits enabled (research R13) with the same env gating, verification and
  reset mail routed through the ADR-022 `sendEmail()` port, and `socialProviders` built
  conditionally from `hasGithub`/`hasGoogle` (ADR-023). The Better Auth route handler lives at
  `app/api/auth/[...all]/route.ts`; `src/proxy.ts` (ADR-026) handles redirects only.
- **Consequences:** auth integrates with the documented data model instead of a parallel one;
  every missing credential maps to a working degraded mode; the E2E suite exercises the real
  tokens/DB rows regardless of transport.

## ADR-031 — Project `.npmrc` pins `registry=https://registry.npmjs.org` (the configured mirror

## is stale)

- **Status:** accepted (2026-09-23)
- **Context:** the user-level `~/.npmrc` sets `registry=https://registry.npmmirror.com`.
  Verified today: `npm view @upstash/ratelimit version` returns **2.1.0** through the mirror
  but **2.2.0** from `registry.npmjs.org` — the version RESEARCH §e pins. Exact-version pins
  (spec §1) can 404 or resolve wrong against a lagging mirror.
- **Decision:** commit a repo-level `.npmrc` containing only
  `registry=https://registry.npmjs.org/`. No token — auth stays user-level and is already
  path-scoped to `registry.npmjs.org`; the parent `~/.npmrc` and `/home/swadhin/package.json`
  remain untouched. Reverting = deleting one file.
- **Consequences:** every pinned install resolves against the source of truth the research
  table was fetched from; CI (which has no user `.npmrc`) behaves identically.

## ADR-032 — shadcn/ui component base: Radix primitives

- **Status:** accepted (2026-09-24)
- **Context:** shadcn CLI 4.21 offers three bases (`base` = Base UI, `radix` = Radix UI,
  `aria` = React Aria) and its `-d` default preset pairs with `base`. Spec §7.1 says
  "shadcn/ui"; NexaCRM (the reference craft level, ADR-002) is built on classic
  Radix-based shadcn, so its component anatomy is what our re-skin targets.
- **Decision:** initialize with `-b radix`. Component set added in Phase 1 only covers what
  Phase 1 renders (button, input, label, card, dialog, dropdown-menu, avatar, switch,
  separator, skeleton, sonner, command) — no speculative primitives (spec §1: features hidden,
  not stubbed; same discipline for components).
- **Consequences:** all primitives match the anatomy measured in RESEARCH §a; later phases add
  components through the same CLI (`pnpm exec shadcn add …`), never hand-written.

## ADR-033 — WCAG AA contrast: thresholds, derived fills, adjusted hexes

- **Status:** accepted (2026-09-24)
- **Context:** spec §4.2 (prompt.md:95) mandates "verify WCAG AA contrast (4.5:1 body text,
  3:1 large text and UI borders) for every token pair in every theme, with an automated
  contrast test." Several spec base hexes miss 4.5:1 against their own background, and the
  derived hover/muted fills (also mandated: "derive hover/active/muted via color-mix") pull
  the background _toward_ the foreground, which lowers contrast further for muted text.
- **Decision:**
  - **Test:** `src/config/themes.test.ts` (Vitest, colocated per ADR-029) asserts, for all
    six presets × both surfaces (background, card): 4.5:1 for body-text pairs (foreground,
    muted-foreground, primary, success, warning, danger, info — including on the derived
    muted/secondary/accent fills) and on-color text (primary-foreground etc.); 3:1 for
    UI/focus pairs (input, accent = focus/ring role, chart-1…5). It also asserts **formula
    parity**: `globals.css` must contain the exact `color-mix` formulas that
    `src/config/themes.ts:derivedTokens()` computes, so the test fails if CSS and TS drift.
  - **Threshold reading of "UI borders":** the control boundary token is `--input`
    (shadcn `border-input` on real controls) — asserted at 3:1. `--border` is a decorative
    hairline/divider; WCAG 1.4.11 exempts pure decoration (identification is carried by
    labels/spacing, and every actual control uses `--input`). Asserting `--border` ≥ 3:1
    would force hairlines to ~#56586b-class values, destroying the subtle-hairline TUI
    language (spec §3) and diverging from the measured NexaCRM craft (RESEARCH: `#222` on
    dark ≈ 1.5:1). Recorded here so the interpretation is explicit, not silent.
  - **Adjusted base hexes** (spec → shipped; each also noted inline in
    `src/config/themes.ts`; ratios measured, background / derived-muted-fill):

    | Preset · token      | Spec hex  | Spec ratio  | Shipped   | Ships       |
    | ------------------- | --------- | ----------- | --------- | ----------- |
    | midnight · muted-fg | `#565f89` | 2.76 / 2.33 | `#8b92b5` | ≥4.5 / ≥4.5 |
    | mocha · muted-fg    | `#6c7086` | 3.36 / 2.77 | `#9399b2` | ≥4.5 / ≥4.5 |
    | gruvbox · muted-fg  | `#928374` | 4.02 / 3.28 | `#ae9f87` | ≥4.5 / ≥4.5 |
    | gruvbox · danger    | `#fb4934` | 4.29 / 3.50 | `#fb5d43` | ≥4.5 / ≥4.5 |
    | phosphor · muted-fg | `#4f7a4f` | 3.89 / 3.32 | `#72a872` | ≥4.5 / ≥4.5 |
    | amber · muted-fg    | `#8a6a2f` | 3.85 / 3.32 | `#b08a45` | ≥4.5 / ≥4.5 |
    | paper · muted-fg    | `#8a857a` | 3.43 / 2.97 | `#69655b` | ≥4.5 / ≥4.5 |
    | paper · warning     | `#9a6a12` | 4.42 / 3.82 | `#8a5e0f` | ≥4.5 / ≥4.5 |
    | paper · info        | `#1b7f8a` | 4.41 / 3.81 | `#156976` | ≥4.5 / ≥4.5 |

    Kept as spec: `paper · accent = #1b7f8a` (4.41:1) — the accent token's asserted role is
    focus/ring (3:1), where it passes; accent is never used as body text.

  - **Derived fills:** muted = foreground 8% over background, secondary = 5%, accent-surface
    = 7%, input = border 50% toward foreground, primary-foreground = background, ring =
    accent, chart-1…5 = primary/success/warning/destructive/info — defined once in
    `globals.css` `:root` and mirrored by `derivedTokens()` in TS.
- **Consequences:** every theme token pair has an automated AA gate (`pnpm test`); spec hex
  deviations are enumerable and justified rather than silent; changing a formula in either
  file without the other breaks the build's test run.

## ADR-034 — shadcn init reconciliation (engine, fonts, dark variant, customizer semantics)

- **Status:** accepted (2026-09-24)
- **Context:** `pnpm exec shadcn init -b radix -p nova` (ADR-032) scaffolds to the current
  shadcn 4.21 house style, which differs from spec §4/ADR-024 in four places: it rewrites
  `src/lib/utils.ts` onto a new `cn` engine (and installs `cn`, `class-variance-authority`,
  `radix-ui`, `tw-animate-css` with **caret** ranges, against spec §1 exact-pinning); it
  injects the Geist **sans** font as `--font-sans` (not in spec §4.1's font list); it wires
  the Tailwind `dark:` variant to a `.dark` class (ADR-024 uses `data-*` attributes); and it
  expects `--accent` to be shadcn's subtle hover surface while spec §4.2 defines `--accent`
  as the vivid Info/Accent brand token used for focus rings.
- **Decision:**
  - **Class engine:** keep the CLI-generated `export { cn } from "cn"` (cn 0.4.0 —
    maintained by shadcn/aidenybai, zero-dependency drop-in for clsx + tailwind-merge, same
    API). Remove now-unreferenced `clsx` and `tailwind-merge`. Pin all four injected deps
    exact: `cn@0.4.0`, `class-variance-authority@0.7.1`, `radix-ui@1.6.7`,
    `tw-animate-css@1.4.0`.
  - **Fonts (spec §4.1 verbatim):** UI chrome = the customizer's font axis (JetBrains Mono
    default; Geist Mono, Fira Code, IBM Plex Mono alternates) — `data-font` selects it by
    setting `--font-sans`/`--font-mono` in `globals.css`, and `html { font-sans }` follows.
    Geist **sans** is removed from `layout.tsx` (not in spec's list). **Inter is deferred**
    with the notes editor / CV preview (spec: Inter is "for prose-heavy areas" — Phase 3+);
    no font is loaded without a consumer. Ligatures toggle ships now (spec §4.1): axis
    `ligatures: "on" | "off"`, default **off** (terminal default).
  - **Dark variant:** `@custom-variant dark` retargeted from `.dark` to the _resolved_ mode
    attribute — `&:is([data-mode="dark"], [data-mode="dark"] *)`. `themeAttrs()` gains
    `data-mode` (resolved light|dark, alongside the preference `data-color-mode`), and the
    no-FOUC inline script sets it together with `data-theme`.
  - **Accent semantics:** `--accent` = spec's vivid Info/Accent hex (focus rings, brand
    regeneration); shadcn's hover surface is a new derived token `--accent-surface`
    (foreground 7% over background), and `@theme inline` maps the `bg-accent`/`hover:bg-accent`
    **utility** to it. Focus styling uses `var(--accent)` directly (2 px outline, spec §4.1),
    so the utility remap never weakens focus visibility.
  - **Custom accent (spec §4.2):** when `overrides.accent` is set, `accentCssVars()` derives
    an inline-style map on `<html>`: `--accent`, `--primary`, `--primary-foreground` (picked
    by `bestForeground()` among theme background/foreground/black/white for ≥4.5:1),
    `--chart-1…5` (accent mixed toward the theme background in steps); `--ring: var(--accent)`
    follows automatically. Pure function shared by SSR, the live store, and tests.
  - **Customizer axes → CSS:** radius → `--radius` (0/0.25/0.5/0.75rem, shadcn's derived
    radii follow); scale → root `font-size` 14/16/18px; layout → `--content-max-width`
    (compact = constrained column, full = edge-to-edge — interpretation of NexaCRM's
    unmeasured "Content Layout" axis, RESEARCH §a lists names only); sidebar variant/mode →
    `--sidebar-gap/-radius/-shadow/-width` per ADR-028 (flush 0px+border / inset 8px /
    floating 12px+shadow; expanded 16rem / icon 48px / full = overlay). Inset/floating
    rounding uses the user's radius axis, keeping one knob for all rounding.
- **Consequences:** spec §4.1/§4.2 and ADR-024 remain the single source of truth while the
  CLI's output is adapted rather than fought; future `shadcn add` runs keep working (they
  only need `cn` + aliases); the four caret deps are re-pinned exact on every install; the
  dark variant, fonts, and accent all flow through `data-*` attributes on `<html>`, which the
  theme store toggles live.

## ADR-035 — ESLint pinned to 9.39.5 (not 10) while eslint-config-next requires it

- **Status:** accepted (2026-09-24)
- **Context:** the first `pnpm lint` under ESLint 10.11.0 crashed with
  `TypeError: contextOrFilename.getFilename is not a function` from `eslint-plugin-react` —
  ESLint 10 removed the deprecated `context.getFilename()` API. Measured on npm today:
  `eslint-config-next@16.3.6` (latest, required for the Next-specific rules) bundles
  `eslint-plugin-react@7.37.5` (peer `^9.7` max), `eslint-plugin-jsx-a11y@6.10.2` (peer `^9`
  max) and `eslint-plugin-import@2.32.0` (peer `^9` max) — **none declares ESLint 10
  support, and no newer releases exist**. `typescript-eslint@8.70.1` and
  `eslint-config-prettier@10.1.8` both accept `^9`.
- **Decision:** pin `eslint@9.39.5` (the `maintenance` dist-tag line). npm marks 9.39.5
  deprecated ("no longer supported") — accepted knowingly: today there is no ESLint major
  that both (a) supports the removed-context-API plugins and (b) is un-deprecated, and lint
  correctness beats lint currency (ADR-004b made the analogous call for TypeScript). The
  alternative — dropping `eslint-config-next` to run ESLint 10 — was rejected: it loses the
  Next-specific rules (sync-script detection etc.) that spec §1's checks rely on.
- **Consequences:** `pnpm lint` passes with zero errors; the deprecation notice is visible
  on every install as a reminder. Re-evaluate when `eslint-config-next`'s bundled plugins
  declare `eslint ^10` (tracked in the appendix).

## ADR-036 — Phase-1 schema: five tables; Better Auth mapped by source-verified

`options.<model>.{modelName,fields}` overrides; `email_verified` rename; dates = column mode

- **Status:** accepted (2026-09-24)
- **Context:** ADR-030 (written from docs in Phase 0) predicted that model/column overrides
  live _inside_ `drizzleAdapter(db, { modelName, field, … })` and that the adapter has a
  "number-for-dates" flag. Reading the installed 1.7.5 source before writing the schema
  (spec §1: verify, don't recall) showed both details differ: `DrizzleAdapterConfig`
  (`@better-auth/drizzle-adapter/dist/index.d.mts`) only accepts
  `provider | schema | usePlural | camelCase | transaction | debugLogs | schemaName` — the
  overrides are **top-level Better Auth options** resolved in
  `@better-auth/core/…/get-tables.mjs` as `options.<model>.modelName` and
  `options.<model>.fields.<field>` — and there is **no date flag**: dates are passed to
  Drizzle as `Date` objects and the _column_ decides storage, while the read path wraps the
  raw value in `new Date(data)` (`customTransformOutput`, harmless around Drizzle's own
  `Date`). The adapter also runs a schema self-check **by default**
  (`checksSchema = options.advanced.database.validateSchema !== false`) that diffs
  `config.schema`'s object keys and Drizzle **column property keys** against the resolved
  `modelName`/`fieldName`s, and `diffSchema` rejects only _required_ extra columns
  (nullable or defaulted extras pass).
- **Decision:**
  - **Phase 1 ships five tables:** `users`, `sessions`, `accounts`, `verifications` (Better
    Auth–owned) + `user_settings` (ours). Deferred to their consuming phases rather than
    created empty: `api_keys` (Phase 6 API), `workspaces`/`workspace_members` (teams are a
    v1 non-goal, spec §15), `audit_log` (first business services, Phase 2). Spec §1's
    "nothing out of phase" applies to schema too; Drizzle migrations are incremental by
    design, so a later table is one reviewed migration, not debt.
  - **Mapping (source-verified contract):** `user: { modelName: "users", fields: {…} }`,
    `session: { modelName: "sessions", storeSessionInDatabase: true (when secondaryStorage,
ADR-030: DB is source of truth), fields: {…} }`, same for `account → accounts`,
    `verification → verifications` (+ `storeInDatabase: true` under Upstash). Field
    overrides are declared **only where snake_case differs from Better Auth's camelCase
    default** (`emailVerified→email_verified`, `createdAt→created_at`, `updatedAt→updated_at`,
    `expiresAt→expires_at`, `userId→user_id`, `ipAddress→ip`, `userAgent→user_agent`,
    `accountId→account_id`, `providerId→provider_id`, `accessToken→access_token`,
    `refreshToken→refresh_token`, `idToken→id_token`, `accessTokenExpiresAt→access_token_expires_at`,
    `refreshTokenExpiresAt→refresh_token_expires_at`); identical fields (`name`, `email`,
    `image`, `token`, `identifier`, `value`, `scope`, `password`) need no override. Drizzle
    column **property keys equal those resolved names** (the self-check and runtime
    lookups key off properties); SQL names match, so the ERD's snake_case is literal. One
    `schema` object keyed by the custom model names feeds both `drizzle(client, {schema})`
    (so `db.query.users…` resolves) and `drizzleAdapter(db, { schema })`.
  - **`advanced.database.generateId = () => ulid()`** so BA-created rows obey ADR-008.
  - **Dates:** `integer({ mode: "timestamp_ms" })` on every BA-written timestamp —
    Drizzle maps `Date → integer ms` (verified `mapToDriverValue(value: Date): number`) and
    reads back `Date`, satisfying both Better Auth and the ERD's integer-ms convention.
    This closes ADR-030's open question: _there is no adapter flag; the column mode is the
    mechanism._
  - **ERD rename `email_verified_at → email_verified`:** Better Auth's field is `type:
"boolean"` (`defaultValue: false`, `input: false`) — it physically cannot store the
    verification _time_, only the fact. The honest name is `email_verified` (0|1); the ERD
    is amended accordingly (this ADR precedes the edit, per the ERD header).
  - **ERD-extra columns stay out of Better Auth's way:** `bio`, `locale`, `timezone`,
    `week_start`, `onboarded_at`, `is_demo`, `joined_during_free_period` on `users`, plus
    everything on `user_settings`, are nullable or defaulted — required by `diffSchema`'s
    "unexpected-required-column" rule and by the fact that BA inserts omit them. No
    fabricated defaults: `locale`/`timezone`/`week_start` are nullable with service-layer
    fallbacks (`en`/`UTC`/`mon` applied only at render, spec line 302 "configurable");
    `joined_during_free_period` defaults **true** because spec line 426 mandates recording
    `true` for early users while `BILLING_ENABLED=false` (ADR-013) — Phase 7 flips it.
- **Consequences:** the default-on schema check passes with zero findings, so a schema
  drift fails loudly at runtime instead of at the first odd SQL error; every future
  Better Auth upgrade must re-verify `get-tables.mjs` + the adapter dist (comment pointers
  land in the code); the five-table migration is reviewable and the remaining identity
  tables arrive with real consumers.

---

## ADR-037 — Better Auth secondary storage + rate limits: always wired (Upstash or memory

stub), DB stays source of truth, explicit fail-open

- **Status:** accepted (2026-09-24)
- **Context:** ADR-030 wants Upstash as Better Auth's secondary storage "only when
  `hasUpstash`", ADR-021 wants a client module that is the real `@upstash/redis` when keyed
  and an in-memory Map stub otherwise, research R13 wants Better Auth's built-in auth rate
  limits, and ADR-014 wants rate-limit fail-open chosen explicitly. Reading the pinned 1.7.5
  source shows how the pieces meet: `rateLimit.storage` becomes effective against
  `secondaryStorage` via the **atomic** `SecondaryStorage.increment(key, ttl)` (BA compares
  `increment <= max`); a _present_ secondary storage makes BA omit the sessions/verifications
  tables unless `storeSessionInDatabase`/`storeInDatabase` are set (`get-tables.mjs`, already
  read for ADR-036); and verification values on a secondary-only path are consumed through
  atomic `getAndDelete`.
- **Decision:**
  - `secondaryStorage` is **always wired** — real Upstash when `hasUpstash`, the ADR-021
    in-memory stub otherwise — so dev, tests and prod run the _same_ code path and differ
    only in durability (ADR-021's own criterion). `storeSessionInDatabase: true` and
    `verification.storeInDatabase: true` are therefore **unconditional**: the database is
    the source of truth (ADR-030) and the secondary layer is pure cache — a lost or
    restarted cache re-reads from SQL, it never loses a session or a reset token.
  - `rateLimit: { enabled: true, storage: "secondary-storage" }` — auth endpoints are
    limited in **every** environment (R13: BA limits on top of the app-level Upstash
    limiter that Phase 5 adds); the counter backend follows ADR-021's env gate (stub in
    dev, distributed in prod). BA's defaults apply (100 req / 10 s); per-route tightening
    waits for a phase that demonstrates the need.
  - **Fail-open is explicit, not incidental:** on backend error, `get`/`getAndDelete`
    resolve `null` (cache miss → SQL serves), `set`/`delete` no-op, and `increment`
    resolves `1` — since BA allows when `increment <= max`, an unreachable backend
    _permits_ the request instead of bricking sign-in. Same deliberate trade as ADR-014;
    to be written down in docs/SECURITY.md at Phase 9 (which ADR-014 already schedules).
  - Recovery from a lost verification mail: `emailVerification.sendOnSignIn: true` — a
    blocked sign-in re-sends the mail, so no extra "resend" page is needed in Phase 1;
    BA's own endpoint rate limit (enabled above) bounds resend abuse.
- **Consequences:** booting needs zero cloud credentials (ADR-021 kept); turning on
  production auth limits is an env-var flip, not a code change; the availability-vs-
  strictness choice for auth endpoints is recorded rather than inherited from an SDK
  default; BA upgrades must re-verify `get-tables.mjs` + the rate-limiter and
  SecondaryStorage contracts (same re-read rule as ADR-036).

---

## ADR-038 — E2E warms the auth graph before browser tests (dev-only native-loader stall)

- **Status:** accepted (2026-09-24)
- **Context:** Building the ADR-029 harness, the first browser-driven sign-up after every
  fresh `pnpm dev` took ~16 s end-to-end and overran Playwright's 10 s expectation, while a
  replay of the same request via `curl` (no page load first) finished in ~130 ms. Temporary
  `[diag]` timestamps plus a `--cpu-prof` capture of the dev server showed the route handler
  body itself is ~140 ms; the event loop is instead blocked ~15.9 s _before_ handler
  invocation, and the CPU profile attributes it to `process.report.getReport()` reached via
  `@neon-rs/load`'s `isGlibc()`. That loader is the native binding picker of
  `libsql` (`@libsql/client → libsql → @neon-rs/load`, per `pnpm why`), which is evaluated
  when `src/server/db` → `src/server/auth` → the `/api/auth/**` route graph first loads. On a
  dev server whose heap is already warm from compiling/serving the client bundle, each
  `getReport()` call costs ~8 s and the loader calls it twice (~15.9 s); on a fresh server
  with no browser traffic yet (curl-only), the identical probe costs milliseconds. The cost is
  a dev-mode interaction between an unbundled native loader and a large Turbopack dev heap —
  not app code; a production `next start` evaluates these modules once at boot on a small heap.
- **Decision:** a dedicated `warmup` Playwright project runs before `chromium` (declared via
  `dependencies`) and issues one cheap `GET /api/auth/get-session` through the `request`
  fixture. Using the HTTP-only fixture (no browser) means no client chunks are compiled yet,
  so the native loader evaluates on a small heap (measured ~0.7 s total) and every following
  test sees a warm graph (sign-up ≈ 250 ms). Tests keep normal timeouts instead of inflating
  them to hide a known one-time dev cost. Related harness fix: the outbox reader only runs
  after a form's success state is visible, because a test that reads `.data/outbox` immediately
  after clicking races the in-flight request.
- **Consequences:** the E2E suite is deterministic and fast; the harness carries one
  documented, side-effect-free warm-up request. `pnpm dev` stays the webServer (ADR-029) and
  production is unaffected. If a `libsql`/`@neon-rs/load` bump removes the probe, the warm-up
  degrades to a harmless request. Reproduce with `NODE_OPTIONS=--cpu-prof pnpm dev` and a
  browser sign-up on a warm server; a `next build && next start` webServer is the fallback if
  this dev-only cost ever regresses.

---

## ADR-039 — Auth rate limiting stays on; only the ceiling is env-tunable (E2E)

- **Status:** accepted (2026-09-24)
- **Context:** ADR-037 enabled Better Auth's rate limiter in every environment. Re-checked at
  the pinned 1.7.5 source (`dist/api/rate-limiter/index.mjs`): BA layers special rules over the
  global 100 / 10 s — every path starting `/sign-in`, `/sign-up`, `/change-password`,
  `/change-email` gets `{ window: 10, max: 3 }`, and password-reset / send-verification mail
  gets `{ window: 60, max: 3 }`, keyed per `ip + path`. The ADR-029/038 suite makes four
  `/sign-in/email` calls (blocked-then-success in test 1, old-then-new password in test 2)
  inside one 10 s window from the same localhost IP, so the fourth returned **429** and the
  reset test could never finish. Adding waits would trade flakiness for minutes of sleep, and
  switching the limiter off for tests would stop exercising it.
- **Decision:** keep the limiter enabled with `storage: "secondary-storage"` everywhere, and
  add one optional documented env knob — `AUTH_RATE_LIMIT_MAX` — which, when set, overrides
  `max` (windows unchanged) for `/sign-in/email`, `/sign-up/email` and
  `/request-password-reset` through BA's `customRules`. The Playwright `webServer` env sets it
  to 100 (`tests/e2e/global-setup.ts`); `.env` and production leave it unset, so BA's defaults
  apply unchanged. Counter, storage backend and fail-open behaviour are untouched.
- **Consequences:** E2E exercises the real limiter path (increment/compare, keys) without
  tripping per-IP defaults that assume distinct clients; production strictness is unchanged and
  still governed by ADR-037. If a future test needs to assert a 429, it must target the default
  rules directly (a run without `AUTH_RATE_LIMIT_MAX`) rather than loosening this further.

---

## ADR-040 — E2E `webServer` is the production build (reconciles ADR-029 and ADR-038)

- **Status:** accepted (2026-09-24)
- **Context:** ADR-029 specifies the Playwright `webServer` as `build && start` ("prod
  behaviour"); ADR-038 was written against a `pnpm dev` server (where the native-loader stall
  it documents is real) and closed with "`pnpm dev` stays the webServer (ADR-029)". The two
  entries contradict each other, so one clause has to be superseded explicitly (this log is
  append-only).
- **Decision:** **ADR-029 wins** — the harness runs `pnpm build && pnpm start`. Verified: the
  suite passes on the production build in 8.4 s, and the warm-up request completes in ~100 ms
  because prod evaluates the auth graph once at boot on a small heap, so ADR-038's warm-up is
  retained only as a cheap guard rather than a load-bearing workaround. ADR-038's closing
  sentence about `pnpm dev` is superseded by this entry; everything else in ADR-038
  (the diagnosis, the `.data/outbox` race fix, the surrounding harness shape) stands.
- **Consequences:** e2e tests the artifact users actually run; dev-only behaviour (e.g. React
  StrictMode's double effect, which the harness did catch and fix in the verify page) is not
  re-tested by e2e and must be exercised when developing. Harness runtime includes a `next
build` per run, cached by `.next` locally and cold in CI.

---

## ADR-041 — Customizer controls use plain token colours (axe cannot resolve `color-mix`)

- **Status:** accepted (2026-09-24)
- **Context:** the axe gate (ADR-029 / spec §13) flagged the Appearance customizer's segmented
  controls with `color-contrast` failures — `#9b9994` on `#8ca5cf` (1.13:1) — while
  `getComputedStyle` on those very elements reported AA-passing colours
  (`rgb(43,42,39)` on `rgb(250,247,240)`, and `rgb(250,247,240)` on `rgb(47,95,179)`,
  ≈7.4–14:1). The reported values are ~50/50 blends of each element's own text and background,
  i.e. axe-core 4.13 fell back to pixel sampling because it could not resolve one colour in the
  cascade: Tailwind v4 compiles opacity modifiers (`hover:bg-primary/80`,
  `dark:hover:bg-input/50`) to `color-mix(in oklab, …)`, which axe's colour parser rejects. The
  shadcn `Button` carries such classes on every variant, so any control using it is at risk of
  the same false positive.
- **Decision:** the customizer's segmented/radio controls render plain `<button>`s using only
  plain token utilities (`bg-primary`, `text-primary-foreground`, `border-border`,
  `bg-background`, `text-foreground`) — no opacity modifiers, no `border-input` (`color-mix`),
  no shadows. The axe rule set stays fully enabled (no rule or selector exclusions), and
  ADR-033's computed contrast suite remains the authority on token pairs. The scan also resets
  interaction state (pointer away, blur) so it evaluates resting styles.
- **Consequences:** the a11y gate passes on real, resolvable colours and can still catch a
  genuine contrast regression. New controls that axe scans should avoid Tailwind opacity
  modifiers, or expect a canvas-sampled false positive; shadcn `Button` remains fine for
  navbar/dialog actions axe already resolves.

---

## ADR-042 — Board engine wiring: one `BoardView` over TanStack Query, nuqs URL state, and a

## per-user system Tasks board

- **Status:** accepted (2026-09-24)
- **Context:** spec §6.1 says "build one board component and reuse it everywhere"; §5 prescribes
  `nuqs` for view/filter/sort state in the URL and TanStack Query for server state with
  optimistic mutations; §6.2 needs an Inbox that triages into Today / Upcoming / Someday / a
  board. ADR-009 (fractional index), ADR-011 (`version` → 409) and ADR-016 (dnd-kit sensors +
  move buttons) already fix the mechanics, and ERD §2.2 fixes the tables.
- **Decision:**
  - **One data path.** Every board surface (Tasks, `/boards/[boardId]`, Phase 3 job boards)
    renders the same `BoardView` keyed by `boardId`, backed by one query key `["board", id]`
    and one service layer (`src/server/boards`) that Server Actions, REST and MCP all call.
    Views (kanban/table/calendar/timeline/grid) are renderers over the same query result.
  - **Server state:** TanStack Query 5.103.2; mutations are optimistic (ADR-011 pattern) and a
    stale `version` rolls the cache back and raises a conflict toast.
  - **URL state:** nuqs 2.10.1 owns `?view=`, `?group=`, `?filter=` and `?card=` (the
    deep-linkable detail sheet), so any board state is shareable by URL (spec §5).
  - **Tasks model:** each user gets exactly one **system Tasks board**, created lazily with the
    columns **Inbox / Today / Upcoming / Someday / Done**. `/tasks` renders that board; `/inbox`
    is the capture-and-triage surface over its Inbox column; "Today"/"Upcoming" are due-date
    saved views over the _same_ cards, never a second storage location. No duplicate task model
    next to `cards`.
  - **Virtualization:** columns virtualize past 100 cards with `@tanstack/react-virtual`
    (`useVirtualizer`), which is what makes the 500-card acceptance line hold.
  - **Templates:** `src/config/board-templates.ts` is pure data (name + columns + optional cards);
    the service seeds a board from it, so the Phase 8 template gallery needs no schema change.
- **Consequences:** keyboard, pointer, REST and MCP share one `move_card`/`update_card` path
  (ADR-016); jobs reuse boards instead of a parallel pipeline table; adding a view or a template
  is config, not migration. Cost: a client query cache to keep coherent — mitigated by keeping
  the service the only writer and invalidating `["board", id]` after each mutation settles.

---

## ADR-043 — Recurring cards materialise forward on completion

- **Status:** accepted (2026-09-24)
- **Context:** spec §6.2 requires recurring tasks (RRULE via `rrule`), and ADR-015 already fixed
  rrule as the parser and UTC as storage. What it did not fix is what "a recurring task" means
  when the card is completed: replace the card, keep the card and mark it done, or spawn the
  next one.
- **Decision:** when a card with `recurrence` **transitions into a done column**, the service
  creates the next occurrence in the board's **first non-done column** (Inbox for the system
  Tasks board), copying title, description, priority, estimate, kind and meta, and keeping the
  completed card as history. The next date is computed from the rule **anchored at the card's
  own due date**, so a "daily at 09:00" task keeps its time of day instead of inheriting the
  moment the parser built the rule; a completion that lands after the next occurrence **skips
  forward** to the next future one, so finishing late never spawns an already-overdue card. A
  `start_at` keeps its lead time to the new due date. Spawn errors are logged, never thrown —
  completing a task must not fail because of recurrence.
- **Consequences:** recurring work never silently disappears and the history of what was done
  is preserved; nothing spawns when the rule is exhausted (`COUNT`) or unparseable. The move
  path also gained the retry that ADR-009 assumed: SQLite raises a UNIQUE error for a taken key
  rather than returning zero rows, and a taken key now appends after the column's last card
  instead of regenerating the same key.

---

## ADR-044 — Career module sits on the board engine, with an append-only stage history

- **Status:** accepted (2026-09-24)
- **Context:** spec §6.3 requires the job pipeline to reuse 6.1 ("uses the shared Kanban engine,
  so all of 6.1 applies") and ERD §2.3 fixes the career tables, including
  `job_applications.card_id` as a **unique** FK to `cards`. Funnel analytics (research (d) §5)
  are derived: research (b) #7 records that job postings vanish and stage timings matter.
- **Decision:**
  - A job **is a card** (`kind = 'job'`, the `job-pipeline` template): drag, ordering, versions,
    filters, saved views, virtualization and the keyboard layer all apply unchanged.
    `job_applications` is the side table holding what a board does not model (company, salary,
    work mode, visa status, source, URL, JD snapshot, resume used, excitement, fit).
  - `stage_history` is a **JSON array appended** on every stage change (`{from, to, at}`), never
    rewritten: time-in-stage, conversion rates and "ghosted" detection are derived from it
    (no summary table in v1, per ERD §2.3).
  - Money is stored as **integer minor units** plus a currency code, matching the finance-lite
    convention in ERD §2.4 — no floats for money anywhere in LifeOS.
  - `jd_snapshot` is stored as text at capture time because postings disappear; that is the
    only copy the funnel/analytics can rely on later.
  - Interview prep entities (`star_stories`, `question_bank`, `coding_problems`) and the growth
    set (`skills`, `achievements`, `projects`) ship their schema now and their UI in the chunks
    that use them — schema-first keeps later migrations out of the acceptance path.
- **Consequences:** the pipeline inherits every board guarantee for free and Phase 3's service
  layer is small (side-table CRUD + stage transitions). Stage history grows with moves, which is
  exactly the audit trail the funnel needs. Resume versions are snapshots (JSON) rather than
  diffs, so a CV export is reproducible from a row alone.

---

### Appendix — deferred/scheduled ADRs

| Will be written                                                            | When                                                              |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| TypeScript 7 (after typescript-eslint widens its peer range)               | re-evaluate post-MVP, per ADR-004b                                |
| ESLint 10 (after eslint-config-next's bundled plugins accept `eslint ^10`) | re-evaluate with the next eslint-config-next release, per ADR-035 |
| Drizzle 1.0 RC migration (or "stay on 0.x")                                | after Phase 4, per ADR-005                                        |
| Dodo go-live / alternate MoR                                               | Phase 7, per ADR-013 (risk R1)                                    |
| PDF export backend (react-pdf vs Playwright)                               | Phase 3 spike, per ADR-017                                        |
| Vector/semantic search activation                                          | post-MVP (see `MVP-SCOPE.md`)                                     |
| OAuth 2.1 for MCP (after Bearer keys)                                      | after Phase 5, per ADR-010                                        |
