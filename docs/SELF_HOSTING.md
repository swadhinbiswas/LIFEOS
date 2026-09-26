# Self-hosting

LifeOS runs anywhere Node 24 and a libSQL/SQLite database run. Nothing requires a paid service: every
external dependency degrades to a documented fallback.

## Requirements

- Node 24, pnpm 9.15
- A libSQL database: a file (`file:.data/lifeos.db`) for a single box, or Turso for a hosted setup
- Optional: Upstash (rate limits), Resend (email), an AI provider key, Dodo (billing, test mode)

## Quickstart

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm build
pnpm start            # http://localhost:3000
```

Create your account at `/sign-up` (the verification link is written to `.data/outbox/` when Resend is
not configured — read it from the file or the server log).

## Environment

Only two variables are required:

| Variable             | Purpose                                |
| -------------------- | -------------------------------------- |
| `DATABASE_URL`       | `file:.data/lifeos.db` or `libsql://…` |
| `BETTER_AUTH_SECRET` | ≥16 chars; `openssl rand -base64 32`   |

### Turso

Two variables, not one. Keep the token out of the URL:

```bash
DATABASE_URL=libsql://<your-database>.turso.io
TURSO_AUTH_TOKEN=<the token from `turso db tokens issue`>
```

The host is not a secret and the token is, so splitting them means `DATABASE_URL` can be printed,
diffed and pasted into a runbook, and `env.ts` can reject the one genuinely broken combination
(`TURSO_AUTH_TOKEN` next to a `file:` URL). A `?authToken=` embedded in the URL also works, but
then the URL itself is a credential.

Then apply the schema. `pnpm db:migrate` prints the host it is about to write to before it writes,
and is the sanctioned way to migrate a shared database — `scripts/dev-migrate.mjs` deliberately
skips remote URLs so a developer's `pnpm dev` can never migrate production by accident (ADR-121).

Everything else is optional and documented in `.env.example`, grouped by the ADR that introduced it:
`TURSO_AUTH_TOKEN`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `TRUSTED_ORIGINS`, Upstash pair,
Resend pair + `EMAIL_FROM`, OAuth pairs, `BILLING_ENABLED` + Dodo keys, `CRON_SECRET`, the AI keys
(`AI_ENCRYPTION_KEY`, `TOOL_APPROVAL_SECRET`, `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/
`GOOGLE_GENERATIVE_AI_API_KEY`/`OPENROUTER_API_KEY`/`AI_COMPATIBLE_BASE_URL`, `AI_DEFAULT_PROVIDER`,
`AI_DEFAULT_MODEL`, `AI_SCRIPTED`).

If you serve the app on a host that differs from `NEXT_PUBLIC_APP_URL` (a second domain, a tunnel, a
reverse proxy), list those origins in `TRUSTED_ORIGINS` (comma-separated) or sign-in returns
`403 INVALID_ORIGIN` — Better Auth only trusts its base URL plus that list (ADR-092).

Paired variables are enforced at boot: setting half of a pair is a startup error, not a silent
half-configured feature. When the Upstash pair is present, Redis accelerates Better Auth sessions,
rate limits and API idempotency but is never the source of truth. Normal session reads use a
five-minute encrypted cookie cache; Redis commands make one attempt that aborts after 500 ms, and
cache/rate-limit/idempotency paths fail open. If Redis is slow or unavailable, expect a cache miss
or a bounded request rather than a multi-second retry hang (ADR-099).

## Docker

Prefer Docker Compose, below — it is this plus a volume, a health check and the environment spelled
out. The raw form, for reference:

```bash
docker build -t lifeos .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=file:/data/lifeos.db \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -v lifeos-data:/data \
  lifeos
```

The image runs migrations on start (`pnpm db:migrate`) then `pnpm start`. Mount a volume at `/data`
so the SQLite file survives restarts.

### Without Redis: what you are actually trading

Upstash is optional and nothing breaks without it. The fallback is an in-memory `Map`, and it is
the fallback in **every** environment — including production. Being concrete about what that costs,
because "optional" should not have to mean "and you will not notice":

| What              | With the in-memory fallback                                               |
| ----------------- | ------------------------------------------------------------------------- |
| Sessions          | Signed cookies still work; Better Auth's secondary storage is per-process |
| Rate limits       | Per-process, and reset by a restart                                       |
| Idempotency keys  | Per-process, so a retry across a restart is not deduplicated              |
| Multiple replicas | Each keeps its own — needs sticky sessions, or set Upstash                |

So for **one container on one box** — the normal self-host — the only real cost is that a restart
signs everybody out and empties the rate-limit counters. That is usually fine. For **two or more
replicas** it is not: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or pin traffic to
one replica.

The boot log says which of the two you got and what the fallback costs, so nobody has to infer it
from a string that says "dev" on a production box.

### Docker Compose

The short path, and the one to use. It is the `Dockerfile` plus a named volume, a health check and
the environment already spelled out.

**Verified, not asserted.** The stack was built and run: `docker compose build` succeeds,
`up -d` starts, `/api/health` answers `200` with `{"ok":true,"database":"file"}` and 19/19
migrations applied, `/` and `/sign-up` both render, `down` leaves the named volume in place, and
`up` again comes back healthy on the same database. Two real defects were found by doing that and
would not have been found by reading the Dockerfile — see the ADR.

```bash
cp .env.selfhost.example .env.selfhost
$EDITOR .env.selfhost          # set BETTER_AUTH_SECRET at minimum
docker compose --env-file .env.selfhost up -d
```

Two things it does that the raw `docker run` above does not. The volume is **named**, not anonymous,
so `docker compose down` keeps the database — an anonymous layer is deleted with the container,
which is a very quiet way to lose a year of habit history. And there is a health check against
`/api/health`, so `depends_on: condition: service_healthy` and an orchestrator's readiness probe both
have something real to ask.

`NEXT_PUBLIC_APP_URL` and `LIFEOS_PORT` must agree, or sign-in returns `403 INVALID_ORIGIN`
(ADR-092). Change the host port in `LIFEOS_PORT` and the URL to match.

### Local SQLite: WAL and the lock

The app puts a file-backed database into **WAL** journal mode with a 10 s busy timeout (ADR-102), so
a read is never blocked by a write and two writers queue instead of erroring out. Two consequences
for a self-hosted box:

- The database directory gains `lifeos.db-wal` and `lifeos.db-shm` sidecar files. **Back up all
  three** together, or use `sqlite3 .data/lifeos.db ".backup out.db"` — copying only the `.db` file
  while the app is running can miss recent writes.
- WAL needs a filesystem with working shared-memory support. A local disk is fine; some network
  mounts (older NFS, certain SMB configurations) are not — put the database on local storage, or use
  Turso (`libsql://…`), where the pragmas are simply ignored.

## Scheduled work

Three `CRON_SECRET`-guarded routes expect a scheduler (Vercel Cron, QStash, or plain cron):

| Route                 | Recommended cadence  | What it does                                       |
| --------------------- | -------------------- | -------------------------------------------------- |
| `/api/cron/webhooks`  | every 5 minutes      | Retries due webhook deliveries                     |
| `/api/cron/activity`  | hourly (`0 * * * *`) | Refreshes each WakaTime connection, at most hourly |
| `/api/cron/proactive` | daily (review Fri)   | Generates opted-in AI briefs/reviews               |
| `/api/cron/purge`     | daily                | Purges accounts past their deletion grace          |

`/api/cron/activity` throttles **per account** against `last_synced_at`, so calling it more often
than hourly costs nothing extra (ADR-129). It is the only one of the four that is optional in
practice: without it, a WakaTime connection is refreshed by the button on `/settings/activity`.

Call them with `Authorization: Bearer $CRON_SECRET`; without the secret the routes return 404.

## Demo data

New accounts start empty. There is no sample-data option: a personal OS that fills a fresh account
with a month of invented tasks, focus sessions and habit logs is showing you data that is not yours
(ADR-123).

## Health and backups

- `GET /api/health` reports the process and database state for liveness/readiness probes.
- Back up the SQLite file (or use Turso point-in-time recovery); the logical backup is the full JSON
  export each user can take from `/settings/data`, plus a nightly copy of the database file.
