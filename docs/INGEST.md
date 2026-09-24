# Ingesting tasks from outside the app (spec §9.1)

`POST /api/v1/ingest` accepts the same quick-capture grammar as the in-app inbox, so an iOS
Shortcut, a browser bookmarklet or an automation can push a task with one request. It is a thin
adapter over the service the inbox box calls (`captureTask`, ADR-015/ADR-065), so `#tags`, natural
dates (`tomorrow 5pm`) and `!2` priority behave identically whichever way the text arrives.

## Request

|               |                                                             |
| ------------- | ----------------------------------------------------------- |
| Method / path | `POST /api/v1/ingest`                                       |
| Auth          | `Authorization: Bearer lifeos_live_…` (scope `write:tasks`) |
| Content-Type  | `application/json`                                          |
| Body          | `{ "text": string, "columnName"?: string }`                 |
| Idempotency   | optional `Idempotency-Key` (replayed for 24 h)              |

Create the key once in **Settings → Integrations**; it is shown a single time.

### curl

```bash
curl -sS https://your-lifeos.example/api/v1/ingest \
  -H "Authorization: Bearer $LIFEOS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"email the landlord tomorrow 9am #home !1"}'
```

A `201` returns the created card and the parsed fields:

```json
{
  "data": {
    "card": { "id": "01J…", "title": "email the landlord", "due_at": "2026-09-25T09:00:00.000Z" },
    "parsed": { "title": "email the landlord", "tags": ["home"], "priority": "p1" }
  }
}
```

## iOS Shortcut recipe

1. Shortcuts → **+** → add **Ask for Input** (Text) — or use the share sheet's **Shortcut Input**.
2. Add **Get Contents of URL**:
   - URL: `https://your-lifeos.example/api/v1/ingest`
   - Method: `POST`
   - Headers: `Authorization` = `Bearer lifeos_live_…` · `Content-Type` = `application/json`
   - Request Body: **JSON** → key `text` = the provided input.
3. (Optional) add **Show Result** to see the created card.

Bind it to the Home Screen or a Back Tap, and a thought becomes a task in the system board's Inbox.

## Errors

Every error uses the shared shape (`ADR-063`):

```json
{ "error": { "code": "forbidden", "message": "…", "details": null, "request_id": "…" } }
```

`401` no/!invalid key · `403` key lacks `write:tasks` · `400` bad body · `429` rate limited.
