/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process (vitest collects and
// runs a file in separate processes, and a shared name races the first DDL into SQLITE_BUSY).
const DB_FILE = `.data/api-keys-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { eq } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { api_keys, users } = await import("@/server/db/schema");
const { createApiKey, listApiKeys, revokeApiKey, scopeAllows, verifyApiKey } =
  await import("./index");

const USER = "01HKEY000000000000000000001";
const OTHER = "01HKEY000000000000000000002";

describe("personal API keys (spec 9.1, adr-062)", () => {
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
  });

  it("creates a hashed key shown once and verifies it back to its owner and scopes", async () => {
    const { plaintext, row } = await createApiKey(USER, { name: "CI", scopes: ["write:tasks"] });
    expect(plaintext.startsWith("lifeos_live_")).toBe(true);
    // The token is never stored.
    expect(row.key_hash).not.toContain(plaintext.split("_")[2]);

    const identity = await verifyApiKey(plaintext);
    expect(identity?.userId).toBe(USER);
    expect(identity?.scopes).toEqual(["write:tasks"]);
    expect(scopeAllows(identity?.scopes ?? [], "write:tasks")).toBe(true);
    expect(scopeAllows(identity?.scopes ?? [], "read:cards")).toBe(false);
    expect(scopeAllows(["read:*"], "read:cards")).toBe(true);

    // last_used is tracked.
    const [afterUse] = await db.select().from(api_keys).where(eq(api_keys.id, row.id));
    expect(afterUse?.last_used_at).not.toBeNull();
  });

  it("rejects a tampered token, a revoked key and an expired key", async () => {
    const { plaintext, row } = await createApiKey(USER, { name: "temp", scopes: ["read:*"] });
    expect(await verifyApiKey(`${plaintext}x`)).toBeNull();

    await revokeApiKey(USER, row.id);
    expect(await verifyApiKey(plaintext)).toBeNull();
    expect((await listApiKeys(USER)).find((key) => key.id === row.id)?.revoked_at).not.toBeNull();

    const expiring = await createApiKey(USER, {
      name: "old",
      scopes: ["read:*"],
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await verifyApiKey(expiring.plaintext)).toBeNull();
  });

  it("keeps keys tenant-scoped", async () => {
    const { plaintext, row } = await createApiKey(OTHER, { name: "other", scopes: ["read:*"] });
    // Another user's key verifies as its own owner, and revoking it from the wrong user does nothing.
    expect((await verifyApiKey(plaintext))?.userId).toBe(OTHER);
    await revokeApiKey(USER, row.id);
    expect(await verifyApiKey(plaintext)).not.toBeNull();
  });
});
