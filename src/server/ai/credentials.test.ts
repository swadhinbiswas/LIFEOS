/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process.
const DB_FILE = `.data/ai-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { deleteCredential, getDecryptedCredential, listCredentials, saveCredential } =
  await import("./credentials");

const USER = "01HAI0000000000000000000001";
const OTHER = "01HAI0000000000000000000002";

describe("AI provider credentials (spec §10, adr-074)", () => {
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

  it("stores a key encrypted and returns only a masked hint", async () => {
    const key = "sk-live-abcdefghij-tail1234";
    const summary = await saveCredential(USER, { provider: "openai", key, model: "gpt-5-mini" });
    expect(summary.hint).toBe("••••1234");
    expect(JSON.stringify(summary)).not.toContain(key);

    const [listed] = await listCredentials(USER);
    expect(listed?.hint).toBe("••••1234");
    expect(JSON.stringify(listed)).not.toContain("tail1234");
  });

  it("decrypts only for the owner's chosen provider", async () => {
    const stored = await getDecryptedCredential(USER, "openai");
    expect(stored?.key).toBe("sk-live-abcdefghij-tail1234");
    expect(stored?.model).toBe("gpt-5-mini");
    expect(await getDecryptedCredential(OTHER, "openai")).toBeNull();
  });

  it("replaces a key on re-save and deletes it", async () => {
    await saveCredential(USER, { provider: "openai", key: "sk-new-key-0000-zzzz9999" });
    expect((await getDecryptedCredential(USER, "openai"))?.key).toBe("sk-new-key-0000-zzzz9999");
    expect(await listCredentials(USER)).toHaveLength(1);

    await deleteCredential(USER, "openai");
    expect(await getDecryptedCredential(USER, "openai")).toBeNull();
  });

  it("keeps credentials tenant-scoped", async () => {
    await saveCredential(OTHER, { provider: "anthropic", key: "sk-ant-other-7890" });
    expect((await listCredentials(USER)).find((c) => c.provider === "anthropic")).toBeUndefined();
    expect((await getDecryptedCredential(OTHER, "anthropic"))?.key).toBe("sk-ant-other-7890");
  });
});
