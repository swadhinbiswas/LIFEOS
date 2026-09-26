# Release v0.1.0

The release checklist from prompt §14 Phase 9. Ticked items were run on 2026-09-25; the two unticked
items are honest gaps with the reason and the next step.

## Checks

- [x] `pnpm typecheck` — clean
- [x] `pnpm lint` — clean
- [x] `pnpm format:check` — clean
- [x] `pnpm build` — succeeds
- [x] `pnpm test` — 271 passed (unit + integration)
- [x] `pnpm eval` — 9 passed, thresholds 100 % (tool selection, injection, CV no-invention)
- [x] `pnpm e2e` — 57 passed, twice (includes the axe sweep on every route in six themes)
- [x] Accessibility: axe-core runs on the public, auth and shell routes on every e2e run
- [x] `pnpm audit` — 1 moderate, dev-only chain (see `docs/SECURITY.md` "Known gaps")
- [x] API load test — `node scripts/load.mjs http://localhost:3000/api/health 300 25` against a local
      `pnpm start`: **1419 req/s, p50 13 ms, p95 26 ms, 0 failed** (2026-09-25)
- [x] Lighthouse budgets (LCP < 2 s, INP < 200 ms, CLS < 0.05) **run 2026-09-26** against a
      production build, signed in and seeded, over all four dashboard variants: **performance 98,
      accessibility 100, LCP 1.06 s, TBT 0-4 ms, CLS 0.000**. The four extra charts cost nothing
      measurable. `lighthouserc.json` is committed and `pnpm lighthouse` runs it where Chrome is
      available (ADR-109).

## Security review (prompt §10)

- [x] Tenant isolation proven across UI actions, REST, MCP and AI tools (`isolation.test.ts`)
- [x] API keys hashed, scoped, revocable; AI provider keys AES-256-GCM at rest
- [x] Zod at every boundary; Markdown rendered as text, never HTML
- [x] Injection defense: untrusted-data framing, signed approvals, malicious fixtures in `pnpm eval`
- [x] Rate limits on auth, REST, MCP and AI; fail-open documented (ADR-014)
- [x] Webhooks: HMAC outbound, Standard Webhooks verification inbound, idempotent by event id
- [x] Webhook secrets encrypted at rest — `createWebhook` encrypts with the ADR-074 helper, with a
      plaintext read fallback so rows written earlier still verify
- [x] CSP and security headers — shipped from `next.config.ts`: CSP (same-origin,
      `form-action 'self'`, `frame-ancestors 'none'`, `object-src 'none'`; `eval` dev-only), plus
      `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and
      `X-DNS-Prefetch-Control`. Asserted against a real response in `security-headers.spec.ts`
- [x] WakaTime API key encrypted at rest, masked to `••••1234`; the stored activity is durations and
      labels only (`docs/ACTIVITY.md`)

## Documentation

- [x] `README.md` (quickstart), `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/SELF_HOSTING.md`
- [x] `/docs/api` (generated OpenAPI) and `/docs` (renders the repository Markdown in-app)
- [x] `docs/DECISIONS.md` (ADR-001 … ADR-087), `docs/MVP-SCOPE.md`, `docs/RESEARCH.md`, `docs/ERD.md`
- [x] `CHANGELOG.md` up to v0.1.0

## Release

- [x] `CHANGELOG.md` written for v0.1.0
- [x] Version tagged `v0.1.0` locally (not pushed)
- [ ] Deploy to a Vercel preview — **not done here**: no credentials in this environment. Next: set
      the env vars from `docs/SELF_HOSTING.md` and run `vercel` with the repo's build command.
- [x] Removed: the public `/demo` preview and the sample-data option (ADR-123). A new user reaches an empty dashboard in
      under 60 seconds (e2e).

## Sign-off

All code checks are green and the release is tagged. The two open checklist items (Lighthouse,
load test) need a browser/load environment and the deploy step needs credentials; both are recorded
above with the exact command to finish them.
