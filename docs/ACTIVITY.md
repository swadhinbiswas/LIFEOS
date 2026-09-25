# Activity tracking (WakaTime)

LifeOS shows your coding activity on the **code** dashboard variant. It does this by reading
WakaTime, not by running its own tracker — see ADR-110 for why.

## What you need

One WakaTime account and its API key. WakaTime already aggregates every sender behind that one
account, so the CLI, the OpenCode plugin, your editor plugins and WakaTime's own mobile app all
land on the same dashboard without a separate LifeOS integration each.

## Setup

### 1. Get the key

In WakaTime: **Settings → API Key**. Copy it.

### 2. Connect it here

LifeOS → **Settings → Activity** → paste the key → **Save**.

The key is encrypted at rest with AES-256-GCM (the same helper that stores AI provider keys,
ADR-074) and is never shown again — only its last four characters. Connecting requires
`AI_ENCRYPTION_KEY` to be set; without it the page says so rather than storing the key in the clear.

### 3. Send activity from somewhere

Any of these. All of them report to the same WakaTime account.

**WakaTime CLI** — works from any editor or shell, including headless work:

```bash
pipx install wakatime
wakatime --api-key waka_your_key_here
```

**OpenCode** — the official WakaTime plugin, so agent sessions count as coding time and their
lines are attributed as AI-written rather than as yours:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@wakatime/opencode-wakatime"]
}
```

**Your phone** — install WakaTime's own mobile app and sign in with the same account. Phone
sessions then appear in the same charts. LifeOS has no phone app; it reads the account.

**Any other harness** — the CLI works from any terminal, and WakaTime publishes a heartbeat API
for tools that want to push directly. LifeOS does not use it: the provider's own guidance is that
an integration should let `wakatime-cli` send heartbeats, and a second pipeline here would
double-count the same keystrokes.

### 4. Sync

Press **Sync now**. A sync pulls the last 30 days and is idempotent — re-syncing overwrites, so a
retry can never double-count.

The dashboard reads a local cache, so opening a page never waits on the network. If a sync fails,
the previously cached days stay readable and the reason is shown in place.

## What is stored

One row per day, in `code_activity_daily`:

| Field                                | Meaning                                       |
| ------------------------------------ | --------------------------------------------- |
| `day`                                | the day, as WakaTime reported it              |
| `total_seconds`                      | coding seconds that day                       |
| `ai_*` / `human_*`                   | lines WakaTime attributes to AI vs to you     |
| `ai_cost_usd`                        | WakaTime's own estimate of that day's AI cost |
| `languages` / `editors` / `projects` | top breakdowns, verbatim                      |

Every value is WakaTime's own number. LifeOS stores and renders them; it never infers, estimates
or recomputes one. The breakdown JSON holds names and durations only.

**Never stored:** the files you edited, the contents of your code, your keystrokes, or your
project's file tree. WakaTime sends durations and labels, not source.

## Verified against

The endpoint, auth scheme and response shape were read from WakaTime's official developer
documentation on 2026-09-26, not from memory:

- base `https://api.wakatime.com/api/v1/`
- `Authorization: Basic base64(apiKey)`
- `GET /users/current/summaries?start=YYYY-MM-DD&end=YYYY-MM-DD`

The service tests run against a fixture in that documented shape. A live run needs your own key,
so it is a manual step rather than part of CI.

## Troubleshooting

| Message                               | Meaning                                           |
| ------------------------------------- | ------------------------------------------------- |
| `the provider rejected the API key`   | the key is wrong, revoked, or lacks access        |
| `the provider answered 5xx`           | WakaTime's side; cached days are still shown      |
| `the provider did not answer in time` | the 8s sync timeout was hit                       |
| `the provider could not be reached`   | DNS/TLS/network — the request never got an answer |

A rejected key and an unreachable host are reported differently on purpose: folding them together
would send you hunting a firewall that is not the problem.
