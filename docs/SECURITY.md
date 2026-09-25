# Security

This is the security posture of the shipped code, reviewed against prompt §10. Each claim points at
the mechanism that enforces it; anything not yet true is listed under "Known gaps" rather than
implied.

## Tenant isolation

- Every service function takes an authenticated `userId` and every query filters it. There is one
  writer per table, so there is no side door around the rule.
- The isolation suite creates two users and proves user A cannot read, update, move, delete, search
  or export user B's data — through the UI actions, REST, MCP and the AI tools (`src/server/api/isolation.test.ts`).
- REST and MCP authenticate to the same services; scopes on an API key are an additional ceiling, not
  a substitute for the owner filter.

## Authentication and sessions

- Better Auth with email + password (Argon2id), email verification, and optional GitHub/Google OAuth
  (buttons appear only when the provider's env pair is set — ADR-023).
- Sessions live in the database with a secondary storage cache; cookies are httpOnly/SameSite, and
  the root layout performs the real session check (the proxy only redirects on cookie presence,
  ADR-026). Normal reads also use Better Auth's encrypted five-minute JWE session cache so a remote
  Redis round trip is not required for every render; that means a revoked session can remain
  authorized for up to five minutes on ordinary page reads. Sensitive auth operations use the
  authoritative server-side path, sign-out clears the cache, and the database remains the source of
  truth (ADR-099).
- Login and reset are rate-limited (Upstash sliding window; in-memory fallback) with a documented
  ceiling override for tests (ADR-039). Redis commands make one attempt with a 500 ms abort;
  cache/rate-limit/idempotency callers fail open explicitly rather than turning a cache outage into
  a hang.

## API keys

- `lifeos_live_<prefix>_<secret>`; only the SHA-256 hash and a prefix are stored, the token is shown
  once, keys are scoped, expirable and revocable, with last-used tracking (ADR-062).

## Secrets at rest

- **AI provider keys** are encrypted with AES-256-GCM using `AI_ENCRYPTION_KEY`; the plaintext is
  decrypted only in the server-side model factory and is never returned to the client — the UI shows
  a `••••1234` hint (ADR-074).
- **Webhook signing secrets** are AES-256-GCM encrypted at rest with the same helper; rows written
  before this change still verify (a plaintext read fallback) and are re-encrypted on their next
  write.
- `.env` is never committed; `.env.example` documents keys without values; `env.ts` validates the
  whole contract at boot and enforces paired variables.

## Input, output and injection

- Zod validates every boundary (Server Actions, REST, MCP, ingest, AI tool inputs).
- Notes are stored as Markdown and rendered as **text**, never `dangerouslySetInnerHTML`, so stored
  content cannot inject markup.
- The AI copilot treats user data as untrusted: it is wrapped in `<untrusted_data>` with a standing
  never-follow-instructions rule, every write is approval-gated, approvals are HMAC-signed with
  `TOOL_APPROVAL_SECRET` so a forged approval is rejected, and malicious fixtures prove an injected
  job description cannot cause a write (ADR-076/077/078, `pnpm eval`).

## Webhooks (outgoing and incoming)

- Outgoing deliveries are signed with HMAC-SHA256 (`x-lifeos-signature`) and retried on an
  exponential backoff; the log is replayable (ADR-066/069).
- Incoming Dodo webhooks verify the Standard Webhooks signature over the **raw** body and dedupe on
  the `webhook-id`, so a replay is a no-op (ADR-081).

## Rate limits and abuse controls

- Sliding-window limits per API key and per IP on REST/MCP; auth endpoints have their own limits;
  the AI copilot is capped per user per month. All of them fail open on a Redis error by explicit
  decision (ADR-014), so an outage degrades rather than blocks.

## Privacy and data ownership

- Minimal analytics, no third-party trackers by default; no user content is used to train anything.
- GDPR-style export (full JSON, per-module CSV, Markdown notes, JSON Resume) and delete-account with
  a 7-day grace plus a `CRON_SECRET`-guarded purge; the audit log is user-visible (ADR-083).
- Provider calls disclose what is sent: the user's message plus a small context (goals, boards,
  habits, and memories only when the user enabled them).

## Supply chain

- `pnpm-lock.yaml` is committed; CI runs the full gate; `pnpm audit` is run in CI and recorded in
  `docs/RELEASE.md`.

## Known gaps (deliberate, with next steps)

1. ~~Webhook secrets are not encrypted at rest~~ — **closed**: encrypted with the ADR-074 helper.
2. ~~No CSP~~ — **closed**: a conservative CSP (same-origin, `form-action 'self'`,
   `frame-ancestors 'none'`, no objects) ships from `next.config.ts`.
3. **SSRF surface is small** (no URL fetching feature yet); when the job clipper or link previews
   land, block private ranges and metadata endpoints.
4. **TOTP 2FA and passkeys** are planned, not shipped.
5. **1 moderate `pnpm audit` advisory** in a dev-only chain (`drizzle-kit → @esbuild-kit → esbuild`
   ≤ 0.24.2); it affects esbuild's dev-server request handling, not our request path. Track the
   upstream bump.
