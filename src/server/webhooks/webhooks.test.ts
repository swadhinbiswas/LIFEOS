/** @vitest-environment node */
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process (vitest collects and
// runs a file in separate processes, and a shared name races the first DDL into SQLITE_BUSY).
const DB_FILE = `.data/webhooks-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { eq } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { users, webhook_deliveries } = await import("@/server/db/schema");
const {
  MAX_ATTEMPTS,
  createWebhook,
  deleteWebhook,
  emitEvent,
  listDeliveries,
  listWebhooks,
  nextAttemptAt,
  retryDelivery,
  retryDueDeliveries,
  signatureFor,
} = await import("./index");

const USER = "01HHOOK00000000000000000001";
const OTHER = "01HHOOK00000000000000000002";

interface Received {
  event: string;
  signature: string;
  body: string;
}

describe("outgoing webhooks (spec 9.3, adr-066/069)", () => {
  const received: Received[] = [];
  let failNext = 0;
  let server: ReturnType<typeof createServer>;
  let url = "";

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [USER, OTHER].map((id) => ({
        id,
        email: `${id.toLowerCase()}@example.test`,
        name: id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );

    server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        received.push({
          event: String(request.headers["x-lifeos-event"] ?? ""),
          signature: String(request.headers["x-lifeos-signature"] ?? ""),
          body,
        });
        if (failNext > 0) {
          failNext -= 1;
          response.writeHead(500);
          response.end("boom");
          return;
        }
        response.writeHead(200);
        response.end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("signs and delivers a subscribed event, and a manual retry re-attempts it", async () => {
    const hook = await createWebhook(USER, { url, events: ["card.created"] });

    await emitEvent(USER, "card.created", { id: "card-1", title: "from a webhook" });
    expect(received).toHaveLength(1);
    expect(received[0]?.event).toBe("card.created");
    // The signature is an HMAC over the exact body with the subscription secret.
    expect(received[0]?.signature).toBe(signatureFor(hook.secret, received[0]?.body ?? ""));

    const deliveries = await listDeliveries(USER);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ response_status: 200, attempts: 1 });
    expect(deliveries[0]?.next_attempt_at).toBeNull();

    await retryDelivery(USER, deliveries[0]?.id ?? "");
    expect(await listDeliveries(USER)).toHaveLength(1); // retried in place
    expect((await listDeliveries(USER))[0]).toMatchObject({ attempts: 2 });
  });

  it("schedules an exponential-backoff retry on failure and delivers on the sweep", async () => {
    // Backoff maths is pure and hand-checkable.
    const now = new Date("2026-09-24T12:00:00.000Z");
    expect(nextAttemptAt(1, now)?.toISOString()).toBe("2026-09-24T12:01:00.000Z");
    expect(nextAttemptAt(2, now)?.toISOString()).toBe("2026-09-24T12:05:00.000Z");
    expect(nextAttemptAt(MAX_ATTEMPTS, now)).toBeNull();

    const before = received.length;
    failNext = 1;
    await emitEvent(USER, "card.created", { id: "card-2" });
    expect(received.length).toBe(before + 1);

    const failed = (await listDeliveries(USER)).find(
      (row) => row.event === "card.created" && !row.delivered_at,
    );
    expect(failed).toBeDefined();
    expect(failed?.attempts).toBe(1);
    expect(failed?.response_status).toBe(500);
    expect(failed?.next_attempt_at).not.toBeNull();

    // Bring the next attempt forward so the sweep (what the cron calls) picks it up, and succeed.
    await db
      .update(webhook_deliveries)
      .set({ next_attempt_at: new Date(Date.now() - 1000) })
      .where(eq(webhook_deliveries.id, failed?.id ?? ""));

    expect(await retryDueDeliveries(new Date(), USER)).toBe(1);
    const delivered = (await listDeliveries(USER)).find((row) => row.id === failed?.id);
    expect(delivered).toMatchObject({ attempts: 2, response_status: 200 });
    expect(delivered?.delivered_at).not.toBeNull();
    expect(delivered?.next_attempt_at).toBeNull();
  });

  it("only fires subscribed events and is tenant-scoped", async () => {
    const count = received.length;
    await emitEvent(USER, "note.created", { id: "note-1" }); // not subscribed
    expect(received).toHaveLength(count);

    await emitEvent(OTHER, "card.created", { id: "other-1" }); // no subscription for OTHER
    expect(received).toHaveLength(count);

    const [hook] = await listWebhooks(USER);
    await deleteWebhook(USER, hook?.id ?? "");
    await emitEvent(USER, "card.created", { id: "card-3" });
    expect(received).toHaveLength(count);
  });
});
