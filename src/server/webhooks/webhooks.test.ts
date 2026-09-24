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
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const {
  createWebhook,
  deleteWebhook,
  emitEvent,
  listDeliveries,
  listWebhooks,
  redeliver,
  signatureFor,
} = await import("./index");

const USER = "01HHOOK00000000000000000001";
const OTHER = "01HHOOK00000000000000000002";

interface Received {
  event: string;
  signature: string;
  body: string;
}

describe("outgoing webhooks (spec 9.3, adr-066)", () => {
  const received: Received[] = [];
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

  it("signs and delivers a subscribed event, then replays it", async () => {
    const hook = await createWebhook(USER, { url, events: ["card.created"] });

    await emitEvent(USER, "card.created", { id: "card-1", title: "from a webhook" });
    expect(received).toHaveLength(1);
    expect(received[0]?.event).toBe("card.created");
    // The signature is an HMAC over the exact body with the subscription secret.
    expect(received[0]?.signature).toBe(signatureFor(hook.secret, received[0]?.body ?? ""));
    expect(JSON.parse(received[0]?.body ?? "{}")).toMatchObject({ event: "card.created" });

    const deliveries = await listDeliveries(USER);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ response_status: 200 });
    expect(deliveries[0]?.delivered_at).not.toBeNull();

    // Replay resends the exact payload as a new delivery.
    await redeliver(USER, deliveries[0]?.id ?? "");
    expect(received).toHaveLength(2);
    expect(await listDeliveries(USER)).toHaveLength(2);
  });

  it("only fires subscribed events and is tenant-scoped", async () => {
    await emitEvent(USER, "note.created", { id: "note-1" }); // not subscribed
    expect(received).toHaveLength(2);

    await emitEvent(OTHER, "card.created", { id: "other-1" }); // no subscription for OTHER
    expect(received).toHaveLength(2);

    // Deleting the subscription stops delivery.
    const [hook] = await listWebhooks(USER);
    await deleteWebhook(USER, hook?.id ?? "");
    await emitEvent(USER, "card.created", { id: "card-2" });
    expect(received).toHaveLength(2);
  });
});
