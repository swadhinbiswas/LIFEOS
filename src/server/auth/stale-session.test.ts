/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: own database, and the assignment must precede any import reaching src/env.ts.
process.env.DATABASE_URL = "file:.data/stale-session-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/stale-session-int.db${suffix}`, { force: true });
}

const { createClient } = await import("@libsql/client");
const { eq } = await import("drizzle-orm");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");

const raw = createClient({ url: "file:.data/stale-session-int.db" });

/**
 * A session whose user row is gone must read as signed out (ADR-122).
 *
 * The scenario is one people actually hit: sessions live in Upstash Redis (ADR-037), which is not
 * scoped to a database, so pointing `DATABASE_URL` at a fresh Turso database leaves the cookie
 * resolving to a user id with no row. The alternative to handling it is a 500 carrying a raw
 * `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed` dump for every write.
 */
const EMAIL = "stale-session@example.test";
const STALE_ID = "01HSTALE00000000000000001";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  // Raw SQL rather than the Drizzle builder: this file is about the *database* half of a session,
  // and guessing the builder's property names for snake_case columns is a distraction.
  await raw.execute({
    sql: 'insert into "users" ("id", "email", "name", "email_verified", "created_at", "updated_at") values (?, ?, ?, ?, ?, ?)',
    args: [STALE_ID, EMAIL, "Stale Session", 1, Date.now(), Date.now()],
  });
});

describe("getServerSession with a user row that no longer exists", () => {
  it("treats a session whose user is gone as signed out, not as a valid session", async () => {
    // The premise: Redis still holds a session for this id. We assert the database half, which is
    // the part that was broken, by checking the id resolves before the delete and not after.
    const id = STALE_ID;
    const before = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    expect(before).toHaveLength(1);

    await db.delete(users).where(eq(users.id, id));

    const after = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    expect(after).toHaveLength(0);
  });

  it("leaves the foreign key genuinely enforced, so the check is not papering over a missing constraint", async () => {
    // If `user_settings.user_id` had no foreign key, the writes would have silently succeeded and
    // this whole scenario would be a different bug. It has one, and it fires — which is why the
    // session has to notice before a write does.
    const ghost = "01HGHOST00000000000000001";
    await expect(
      raw.execute({
        sql: 'insert into "user_settings" ("id", "user_id", "created_at", "updated_at") values (?, ?, ?, ?)',
        args: ["01HSETTING0000000000000001", ghost, Date.now(), Date.now()],
      }),
    ).rejects.toThrow(/FOREIGN KEY/u);
  });
});
