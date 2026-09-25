#!/usr/bin/env -S npx tsx
/**
 * The `lifeos` CLI (spec §9.1): a thin client over the REST API, so a terminal, a shortcut or a
 * script can capture and read without opening the app. It holds no logic of its own — the quick-add
 * parser and the board moves run on the server, exactly as they do in the UI.
 *
 *   LIFEOS_URL=http://localhost:3000 LIFEOS_KEY=lifeos_live_… lifeos today
 *   lifeos add "call the recruiter tomorrow 3pm #career"
 *   lifeos jobs move <application-id> interview
 */

const BASE = (process.env.LIFEOS_URL ?? "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.LIFEOS_KEY ?? "";

interface ApiError {
  error?: { code?: string; message?: string; request_id?: string };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (KEY === "") {
    throw new Error("set LIFEOS_KEY to a personal API key (Settings → Integrations)");
  }
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiError;
    const message = body.error?.message ?? `request failed (${response.status})`;
    const requestId = body.error?.request_id ? ` [${body.error.request_id}]` : "";
    throw new Error(`${message}${requestId}`);
  }
  return (await response.json()) as T;
}

interface CardSummary {
  id: string;
  title: string;
  due_at?: string | null;
  completed_at?: string | null;
}

function localDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function add(text: string, column?: string): Promise<void> {
  if (text.trim() === "") throw new Error('usage: lifeos add "<text>"');
  const body = await api<{ data: { card: CardSummary } }>("/api/v1/ingest", {
    method: "POST",
    body: JSON.stringify({ text, columnName: column }),
  });
  const card = body.data.card;
  const due = card.due_at ? ` (due ${card.due_at.slice(0, 16).replace("T", " ")})` : "";
  console.info(`added: ${card.title}${due}`);
}

async function today(): Promise<void> {
  const body = await api<{ data: CardSummary[] }>("/api/v1/cards?limit=100");
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const open = body.data.filter((card) => card.completed_at == null);
  const due = open
    .filter((card) => card.due_at != null && new Date(card.due_at) <= endOfToday)
    .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)));

  if (due.length === 0) {
    console.info("nothing due today — clear.");
    return;
  }
  const todayKey = localDay(new Date());
  for (const card of due) {
    const overdue = String(card.due_at).slice(0, 10) < todayKey;
    console.info(`${overdue ? "!" : "-"} ${card.title}${overdue ? "  (overdue)" : ""}`);
  }
}

async function moveJob(applicationId: string, stage: string): Promise<void> {
  if (!applicationId || !stage) throw new Error("usage: lifeos jobs move <application-id> <stage>");
  await api(`/api/v1/jobs/${applicationId}/stage`, {
    method: "POST",
    body: JSON.stringify({ stage }),
  });
  console.info(`moved ${applicationId} → ${stage}`);
}

function usage(): void {
  console.info(
    [
      "lifeos — a thin client over the LifeOS API",
      "",
      '  lifeos add "<text>"                 capture a task (dates, #tags and !p1 are parsed)',
      "  lifeos today                        what is overdue or due today",
      "  lifeos jobs move <id> <stage>       move an application to a stage (e.g. interview)",
      "",
      "Environment: LIFEOS_URL (default http://localhost:3000), LIFEOS_KEY (personal API key).",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "add") {
    await add(rest.join(" "));
    return;
  }
  if (command === "today") {
    await today();
    return;
  }
  if (command === "jobs" && rest[0] === "move") {
    await moveJob(rest[1] ?? "", rest.slice(2).join(" "));
    return;
  }
  usage();
}

main().catch((error: unknown) => {
  console.error("[lifeos]", error instanceof Error ? error.message : error);
  process.exit(1);
});
