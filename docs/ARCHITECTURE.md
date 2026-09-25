# Architecture

LifeOS is a Next.js 16 App Router application (React 19, TypeScript strict) on Turso/libSQL via
Drizzle, with Upstash for rate limits, Better Auth for sessions, and the AI SDK for the copilot.

## The one rule: a single service layer

All business logic lives in `src/server/<module>/index.ts`. Every other surface is a **thin adapter**
over the same service functions and the same Zod schemas:

```
UI (Server Components, Server Actions)
REST  /api/v1            ─┐
MCP   /api/mcp           ─┼─→  src/server/<module>  ──→  Drizzle ──→ libSQL
AI    tools + /api/ai    ─┘        (single writer per table)
```

This is why the UI, the REST API, the MCP tools and the AI tools can never drift apart: they cannot
do something the service layer does not already do. It is also the one place authorization, plan
limits and audit logging are enforced.

## Layers

| Layer           | Location                                                            | Notes                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Routes          | `src/app/**`                                                        | Thin: fetch, stream, render. No business logic.                                                                                                                                                              |
| Adapters        | `src/app/api/**`, `src/server/api/**`                               | REST envelope, MCP transport, ingest, OpenAPI, cron.                                                                                                                                                         |
| Domain services | `src/server/<module>`                                               | The writers. Every query filters `user_id` (tenant rule).                                                                                                                                                    |
| Data            | `src/server/db`                                                     | Drizzle schema + committed migrations in `drizzle/`.                                                                                                                                                         |
| Cross-cutting   | `src/server/{auth,ai,activity,billing,data,notifications,webhooks}` | Sessions, copilot, plans, export/delete, crons. WakaTime activity is a _read-only_ integration: it caches a remote source, so it is the one module allowed a denormalised row (ADR-110, `docs/ACTIVITY.md`). |
| UI primitives   | `src/components/{ui,tui}`                                           | shadcn primitives re-skinned; TUI Panel/StatusLine/Kbd.                                                                                                                                                      |
| Configuration   | `src/config`                                                        | nav, shortcuts, themes, board templates, plans, seed profiles.                                                                                                                                               |

## Cross-cutting invariants

- **Tenant isolation (ADR-026/068).** Every service function takes the authenticated `userId` and
  every query includes it. The isolation suite proves user A cannot reach user B's data through the
  UI, REST, MCP or AI tools.
- **Single writer per table.** One module owns each table; no other module issues a write.
- **Validation at the boundary.** Zod schemas are shared by client, Server Actions, REST, MCP and AI
  tools; the OpenAPI document is generated from them.
- **Idempotency.** REST POSTs accept `Idempotency-Key`; webhook deliveries dedupe on their event id;
  generated notifications dedupe on `user_id + dedupe_key`.
- **Secrets.** Provider keys are AES-256-GCM encrypted at rest and never returned to the client;
  everything optional degrades to a documented fallback (file DB, in-memory limiter, file outbox,
  scripted AI model) rather than crashing.

## Request paths worth knowing

- **Boards/tasks:** Server Components read; Server Actions and optimistic TanStack Query mutations
  write through the boards service with an ADR-011 version check.
- **REST/MCP:** Bearer API key (SHA-256 hashed, scoped) or session cookie; one error envelope; the
  MCP server is stateless Streamable HTTP with tools, resources and prompts (ADR-064/071).
- **AI copilot:** `POST /api/ai/chat` resolves the model (BYO → platform → scripted), attaches the
  approval policy, streams UI messages and persists the conversation. Writes require an approval
  signed with `TOOL_APPROVAL_SECRET` (ADR-076).
- **Scheduled work:** `CRON_SECRET`-guarded routes for webhook retries, proactive AI messages and
  account purges.

## Data flow constraints

Positions use fractional indexing (ADR-009) so a drag is one row update; timestamps are integer
milliseconds UTC; day bucketing happens in the user's timezone (ADR-057) with a configurable week
start (ADR-058). Soft deletes (`deleted_at`) back the trash; a hard delete is only the account purge.
