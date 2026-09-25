# Changelog

All notable changes to LifeOS. The format follows [Keep a Changelog](https://keepachangelog.com/);
this project aims for [Semantic Versioning](https://semver.org/) from v0.1.0.

## [0.1.0] — 2026-09-25

The first complete build: the product, the open data surfaces, the AI copilot, billing-ready
plumbing and data ownership.

### Added

- **Shell and design system** — six themed presets with a live customizer, the TUI skin
  (Panel/StatusLine/Kbd/AsciiMeter/Spark), keyboard-first navigation, a command palette, a `?`
  cheat-sheet, and en/bn localization across every surface.
- **Boards and tasks** — Kanban and table views, fractional ordering, optimistic writes with
  version checks, undo/redo, saved views, bulk actions, virtualised long columns, natural-language
  capture, recurring tasks, and the Inbox/Today/Upcoming/Someday/Done system board.
- **Career** — a job pipeline on the board engine, companies, interviews, offers, funnel analytics,
  portfolio and skills (with a research-derived sample import), and interview prep.
- **Life modules** — habits with streaks, goals with derived key results, notes with backlinks and
  full-text search, calendar (month/week/agenda), focus timer, finance-lite, health-lite, learning,
  reviews, notifications, tags and cross-module links.
- **Open data (Phase 5)** — REST `/api/v1` with cursor pagination, sparse fields, ETag/If-Match and
  Idempotency-Key; a resource registry covering every module; an MCP server with tools, resources
  and prompts; `POST /api/v1/ingest`; HMAC webhooks with exponential-backoff retries; OpenAPI 3.1
  at `/api/v1/openapi.json` and a themed `/docs/api`.
- **AI copilot (Phase 6)** — provider-agnostic (BYO/platform/scripted), 28 tools over the service
  layer, approval-gated writes with HMAC-signed approvals, untrusted-data injection defenses, an
  eval suite (`pnpm eval`), memory, and opt-in proactive briefs/reviews.
- **Billing and data ownership (Phase 7)** — config-driven plans and entitlements, Dodo
  checkout/portal/webhook plumbing behind `BILLING_ENABLED=false`, full export/import, delete-account
  with a grace period, and a user-visible audit log.
- **Onboarding, templates, seed, landing (Phase 8)** — a research-derived labelled seed, starter
  profiles composed with board templates, the 60-second onboarding flow, a public TUI-hero landing,
  a no-account demo, and an in-app docs site.

### Security

- Tenant isolation enforced in the service layer and proven across every surface; API keys hashed and
  scoped; AI provider keys AES-256-GCM at rest; Zod at every boundary; signed tool approvals.

### Known limitations

- Webhook secrets are stored as plaintext, and CSP/security headers are not yet set — both tracked in
  `docs/SECURITY.md`.
- Resume/CV tools and the CV builder are not implemented; import is intentionally partial.
- Lighthouse budgets and the API load test are committed but were not run in this environment.
