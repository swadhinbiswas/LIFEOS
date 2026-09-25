# API

LifeOS exposes the same service layer over three surfaces: **Server Actions** for the web app,
**REST `/api/v1`** for scripts and integrations, and **MCP `/api/mcp`** for AI agents. This document
covers the REST API. Its machine-readable contract is generated from the same Zod schemas:

- OpenAPI 3.1: [`/api/v1/openapi.json`](/api/v1/openapi.json)
- Interactive reference: [`/docs/api`](/docs/api)
- MCP setup and tools: [`docs/INGEST.md`](./INGEST.md) and the list in `/llms.txt`

## Authentication

Create a personal API key in **Settings → Integrations**. The key is shown **once** and stored only
as a SHA-256 hash plus a short prefix.

```
Authorization: Bearer lifeos_live_…
```

Keys are scoped (`read:*`, `write:tasks`, `write:jobs`, `write:notes`, …), can expire, track last
use and revoke instantly. Session cookies also authenticate the API from the web app, so the browser
needs no key.

## Errors

Every failure returns one shape, so a client needs one parser:

```json
{
  "error": {
    "code": "validation_error",
    "message": "due_before must be an ISO date",
    "details": { "field": "due_before" },
    "request_id": "req_01J…"
  }
}
```

`code` is stable and safe to branch on; `message` is for humans; `request_id` appears in logs, so
quote it in a bug report.

## Conventions

| Concern         | Behaviour                                                                            |
| --------------- | ------------------------------------------------------------------------------------ |
| Pagination      | Cursor: `?limit=50&cursor=…`; the response carries `next_cursor` until the last page |
| Filtering       | Resource-specific query params, e.g. `?status=applied&board_id=…&q=…&due_before=…`   |
| Field selection | `?fields=id,title,due_at` returns only those keys                                    |
| Concurrency     | Reads return `ETag`; send `If-Match` on updates, or a stale write returns `409`      |
| Idempotency     | `Idempotency-Key: <uuid>` on any `POST` makes a retry safe                           |
| Rate limits     | Per key and per IP; `X-RateLimit-*` and `Retry-After` headers on every response      |

## Resources

`GET /api/v1/<resource>` and `GET /api/v1/<resource>/<id>` for list and detail, `POST` to create,
`PATCH` to update, `DELETE` where supported. Collection routes accept `?limit` and `?cursor`.

| Resource                                                 | Create | Notes                                                                              |
| -------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| `cards`                                                  | ✅     | Cards on any board; `POST /api/v1/cards/<id>/move` and `/complete` for board moves |
| `tasks`                                                  | —      | Alias view of `cards` on the system tasks board                                    |
| `jobs`                                                   | ✅     | Applications; stage changes go through the move endpoint like any card             |
| `notes`                                                  | ✅     | Markdown, sanitized at render                                                      |
| `habits`                                                 | ✅     | `POST /api/v1/habits/<id>/logs` to log a day                                       |
| `goals`                                                  | ✅     | Key results ride along on the goal                                                 |
| `accounts`, `transactions`, `subscriptions`              | ✅     | Finance is manual-only: no bank connections                                        |
| `health`, `courses`, `books`, `reviews`, `notifications` | ✅     |                                                                                    |

## Examples

```bash
# List open cards, only the fields needed
curl -s "https://your-host/api/v1/cards?limit=20&fields=id,title,due_at" \
  -H "Authorization: Bearer $LIFEOS_KEY"

# Capture a task from anywhere
curl -s -X POST "https://your-host/api/v1/ingest" \
  -H "Authorization: Bearer $LIFEOS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Call the recruiter tomorrow 3pm #career !p1"}'
```

```ts
const response = await fetch(`${base}/api/v1/transactions?limit=50`, {
  headers: { Authorization: `Bearer ${key}` },
});
const { items, next_cursor } = await response.json();
```

```python
import requests

r = requests.post(
    f"{base}/api/v1/notes",
    headers={"Authorization": f"Bearer {key}"},
    json={"title": "Call notes", "body": "## Scope\n- ..."},
)
r.raise_for_status()
```

## Ingest

`POST /api/v1/ingest` is the fast path from a Shortcut, Zapier/n8n/Make, the CLI or an extension. It
takes the same quick-add text the capture box does — dates, `#tags` and `!p1` are parsed server-side
— and returns the created card plus what was parsed.

```json
{ "text": "Call the recruiter tomorrow 3pm #career !p1", "columnName": "Inbox" }
```

`columnName` is optional (it defaults to the inbox). See [`docs/INGEST.md`](./INGEST.md) for recipes.

## Export

`GET /api/v1/export?format=ics` returns every dated item — task due dates, interviews and
subscription renewals — as an iCalendar file (`text/calendar`, `attachment`). It is an
**authenticated download**: the key travels in the header, never in the URL, so a calendar client is
imported from a trusted place with no capability left in a query string (ADR-090). The in-app
"download .ics" link on `/calendar` uses the session cookie and needs no key.

## CLI

The `lifeos` CLI is a thin client over this API — see [`docs/CONTRIBUTING.md`](./CONTRIBUTING.md#cli)
for installation, or:

```bash
LIFEOS_URL=http://localhost:3000 LIFEOS_KEY=lifeos_live_… npx lifeos today
```
