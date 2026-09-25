# LifeOS

A free, open, AI-connected personal operating system: tasks and Kanban boards, a career module
(job pipeline, portfolio, interview prep), habits, goals, notes, focus, finance-lite, health-lite,
learning — keyboard-first, in a terminal-styled web app.

Your data is reachable through a REST API, an MCP server and webhooks, and an AI copilot acts on it
through the same tool layer — proposing every write for your approval.

## Quickstart

```bash
pnpm install
cp .env.example .env          # fill in DATABASE_URL and BETTER_AUTH_SECRET at minimum
pnpm db:migrate
pnpm dev                      # http://localhost:3000
```

Sign up, and onboarding lands you on a populated dashboard in under a minute. To look around without
an account, seed the demo and open `/demo`:

```bash
pnpm db:seed                  # builds the sample workspace from docs/research/
pnpm db:seed -- --reset       # rebuilds it from scratch
```

## Commands

| Command            | What it does                                        |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Development server                                  |
| `pnpm build`       | Production build                                    |
| `pnpm typecheck`   | TypeScript                                          |
| `pnpm lint`        | ESLint                                              |
| `pnpm test`        | Unit + integration tests (Vitest)                   |
| `pnpm eval`        | AI evaluation suite (tool selection, injection, CV) |
| `pnpm e2e`         | End-to-end + axe accessibility (Playwright)         |
| `pnpm db:generate` | Generate a migration from the schema                |
| `pnpm db:migrate`  | Apply migrations                                    |
| `pnpm db:seed`     | Seed the demo workspace                             |

The standing gate is `typecheck` · `lint` · `format:check` · `test` · `build`, plus `e2e` for
anything that touches a route.

## Configuration

Everything is optional except the database and the auth secret (see `.env.example`): Upstash for
rate limiting (in-memory fallback), Resend for email (file outbox fallback), OAuth providers
(buttons hidden without keys), AI provider keys (scripted model fallback), Dodo billing (hidden
unless enabled and keyed), and cron secrets that guard the scheduled routes.

## Documentation

- `docs/HANDOFF.md` — current state, gaps and gotchas
- `docs/DECISIONS.md` — every non-obvious decision (ADR log)
- `docs/MVP-SCOPE.md` — what ships and what is deferred
- `docs/RESEARCH.md` — Phase-0 research, library verification, open risks
- `docs/ERD.md` — the data model
- `docs/ACTIVITY.md` — WakaTime setup: CLI, OpenCode plugin, phone, and what is stored
- `/docs` — the same documents, rendered in the app
- `/docs/api` — the generated OpenAPI reference

## License

Source-available for evaluation; the bundled NexaCRM template was studied for measurements only and
never copied (see `docs/DECISIONS.md`).
