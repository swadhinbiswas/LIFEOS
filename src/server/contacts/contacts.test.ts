/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import that
// reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/contacts-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/contacts-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { createContact, listContacts, listOwedContacts, updateContactFollowUp } =
  await import("./index");

const USER = "01HCONTACTS00000000000001";
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-27T12:00:00.000Z");

describe("the people queue (adr-132)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "contacts@example.test",
      name: "Contacts",
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("owes nobody until a promise is made", async () => {
    await createContact(USER, { name: "Ravi" });
    // Nineteen days of silence is not a debt. Without a `followUpAt` there is nothing to owe, and a
    // list built from "have not spoken recently" is a guilt list wearing a to-do list's clothes.
    expect(await listOwedContacts(USER, NOW)).toEqual([]);
    expect(await listContacts(USER)).toHaveLength(1);
  });

  it("owes a reply once the promise has come round", async () => {
    const [ravi] = await listContacts(USER);
    await updateContactFollowUp(USER, {
      contactId: ravi!.id,
      followUpAt: new Date(NOW.getTime() - 2 * DAY),
    });
    const owed = await listOwedContacts(USER, NOW);
    expect(owed).toHaveLength(1);
    expect(owed[0]).toMatchObject({ name: "Ravi", daysOverdue: 2 });
    // Keeping the promise is also recorded, in the same write.
    expect(owed[0]?.lastContactedAt).toBeInstanceOf(Date);
  });

  it("does not call a promise made for later overdue", async () => {
    const [ravi] = await listContacts(USER);
    await updateContactFollowUp(USER, {
      contactId: ravi!.id,
      followUpAt: new Date(NOW.getTime() + 3 * DAY),
    });
    expect(await listOwedContacts(USER, NOW)).toEqual([]);
  });

  it("counts a promise made for today as due, not late", async () => {
    const [meera] = await createAndGet("Meera-today");
    await updateContactFollowUp(USER, {
      contactId: meera.id,
      followUpAt: new Date(NOW.getTime() - 60 * 1000),
    });
    const owed = await listOwedContacts(USER, NOW);
    const row = owed.find((contact) => contact.name === "Meera-today");
    // `lte`, not `lt`: a list that starts tomorrow is a list that is wrong when you read it.
    expect(row).toBeDefined();
    expect(row?.daysOverdue).toBe(0);
  });

  it("clears the promise, and the contact leaves the queue", async () => {
    // A distinct name from the test above: these share one database, and clearing "Meera" would
    // have cleared whichever row the id resolved to.
    const [cleared] = await createAndGet("Meera-cleared");
    await updateContactFollowUp(USER, {
      contactId: cleared.id,
      followUpAt: new Date(NOW.getTime() - DAY),
    });
    expect((await listOwedContacts(USER, NOW)).some((c) => c.name === "Meera-cleared")).toBe(true);
    await updateContactFollowUp(USER, { contactId: cleared.id, followUpAt: null });
    expect((await listOwedContacts(USER, NOW)).some((c) => c.name === "Meera-cleared")).toBe(false);
  });

  it("keeps one user's contacts out of another's", async () => {
    const other = "01HCONTACTS00000000000002";
    await db.insert(users).values({
      id: other,
      email: "other@example.test",
      name: "Other",
      created_at: new Date(),
      updated_at: new Date(),
    });
    const [theirs] = await createAndGet("Theirs", other);
    await updateContactFollowUp(other, {
      contactId: theirs.id,
      followUpAt: new Date(NOW.getTime() - 5 * DAY),
    });
    expect((await listOwedContacts(USER, NOW)).some((c) => c.name === "Theirs")).toBe(false);
    expect((await listOwedContacts(other, NOW)).some((c) => c.name === "Theirs")).toBe(true);
  });

  it("orders the queue by how late each promise is", async () => {
    const [a] = await createAndGet("Aisha");
    const [b] = await createAndGet("Bo");
    await updateContactFollowUp(USER, {
      contactId: b.id,
      followUpAt: new Date(NOW.getTime() - 9 * DAY),
    });
    await updateContactFollowUp(USER, {
      contactId: a.id,
      followUpAt: new Date(NOW.getTime() - DAY),
    });
    const owed = await listOwedContacts(USER, NOW);
    const first = owed[0];
    const second = owed[1];
    // The most overdue first, because that is the order a queue is read in.
    expect(first?.daysOverdue).toBeGreaterThanOrEqual(second?.daysOverdue ?? 0);
  });
});

async function createAndGet(name: string, userId = USER) {
  const created = await createContact(userId, { name });
  return [created] as const;
}
