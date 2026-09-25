# Contributing

LifeOS is a Next.js app with a strict separation between the UI and the data. Read
[`AGENTS.md`](../AGENTS.md) and [`prompt.md`](../prompt.md) first; when they disagree, `prompt.md`
wins.

## Setup

```bash
pnpm install
cp .env.example .env      # fill in the values you need; never commit .env
pnpm db:migrate
pnpm db:seed              # the demo workspace (pnpm db:seed -- --reset to rebuild)
pnpm dev
```

Sign in with the seeded demo account, or create your own. Every integration is optional; the app
runs with the defaults in `.env.example`.

## The gate

Every change must pass the standing gate before it is committed:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

Anything that touches a route also runs the end-to-end suite (Playwright, including the axe sweep):

```bash
pnpm e2e
```

`pnpm eval` runs the AI fixture suite (tool selection, injection resistance, the CV
never-invent-a-fact check) and is required for changes under `src/server/ai`.

## Layout

- `src/server/<module>` — services. **One writer per table.** Every function takes `userId` and every
  query filters on it; this is how tenant isolation is enforced, and it is not optional.
- `src/app/(app)/<route>` — pages. Pages call services directly on the server; there is no client
  data layer.
- `src/app/api/…` — REST, MCP and webhooks. These are **thin adapters**: validate with the shared Zod
  schema, call the service, shape the response.
- `src/config` — nav, shortcuts, themes, board templates, registries. Names live here as data, not as
  UI copy.
- `src/components/ui` — shadcn/ui primitives. Install with the CLI (`pnpm dlx shadcn add <name>`); do
  not hand-write primitives.
- `src/components/tui` — the shared TUI primitives (`PageHeader`, `StatCard`, `Panel`, …). Prefer
  these over ad-hoc markup.

## Conventions

- **Conventional Commits**, small and reviewable; the subject starts lowercase. Explain the _why_ in
  the body, one line per point.
- **Every non-obvious decision gets an ADR** in [`docs/DECISIONS.md`](./DECISIONS.md) _before_ the
  code that implements it (context, decision, consequences).
- **No invented facts.** Sample data is derived from `docs/research/` or visibly labelled `sample`,
  and fictional names carry a `(sample)` marker.
- **No placeholders in shipped UI.** No lorem ipsum, no dead buttons, no TODO screens — hide
  out-of-phase features instead.
- **Verify, don't recall.** Open the current docs for a library and pin exact versions; the version
  table in `docs/RESEARCH.md` is a snapshot, not a promise.
- **Security is not optional.** Zod at every boundary, sanitized markdown, hashed API keys, secrets
  only from the environment. `.env.example` documents keys without values.

## Docs

The repository Markdown is the in-app docs source: register new documents in
`src/server/docs/index.ts` and they appear at `/docs`. Keep [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md),
[`docs/SECURITY.md`](./SECURITY.md) and [`docs/RELEASE.md`](./RELEASE.md) current as part of the
change, not after it.

## CLI

`lifeos` is a small Node client over the REST API, useful for scripts and Shortcuts.

```bash
LIFEOS_URL=http://localhost:3000 LIFEOS_KEY=lifeos_live_… node src/cli/index.ts today
node src/cli/index.ts add "call the recruiter tomorrow 3pm #career"
node src/cli/index.ts jobs move <application-id> interview
```

Environment: `LIFEOS_URL` (default `http://localhost:3000`) and `LIFEOS_KEY` (a personal API key
from Settings → Integrations). See [`docs/API.md`](./API.md).
