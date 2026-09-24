/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/capture-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/capture-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { and, eq } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { card_labels, labels, users } = await import("@/server/db/schema");
const { getBoard } = await import("@/server/boards");
const { captureTask } = await import("./index");

const USER = "01HCAPTURE00000000000000001";

describe("quick capture via the service (spec 4.3/6.2)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "capture-int@example.test",
      name: "Capture",
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("parses the grammar into an Inbox card with a real label", async () => {
    const result = await captureTask(USER, "buy milk tomorrow 5pm #home !2");
    if (!result) throw new Error("capture returned null");

    expect(result.parsed.title).toBe("buy milk");
    expect(result.card.title).toBe("buy milk");
    expect(result.card.priority).toBe("p2");
    expect(result.card.due_at).not.toBeNull();

    const board = await getBoard(USER, result.card.board_id);
    const inbox = board.columns.find((column) => column.name === "Inbox");
    expect(result.card.column_id).toBe(inbox?.id);

    const [label] = await db
      .select()
      .from(labels)
      .where(and(eq(labels.board_id, result.card.board_id), eq(labels.name, "home")));
    expect(label).toBeDefined();

    const links = await db
      .select()
      .from(card_labels)
      .where(eq(card_labels.card_id, result.card.id));
    expect(links).toHaveLength(1);
  });

  it("reuses an existing label instead of duplicating it", async () => {
    const first = await captureTask(USER, "water plants #home");
    const second = await captureTask(USER, "clean desk #home");
    if (!first || !second) throw new Error("capture returned null");

    const rows = await db
      .select()
      .from(labels)
      .where(and(eq(labels.board_id, first.card.board_id), eq(labels.name, "home")));
    expect(rows).toHaveLength(1);

    for (const cardId of [first.card.id, second.card.id]) {
      const links = await db.select().from(card_labels).where(eq(card_labels.card_id, cardId));
      expect(links).toHaveLength(1);
    }
  });

  it("captures tags-only text and refuses empty input", async () => {
    const tagged = await captureTask(USER, "#someday");
    if (!tagged) throw new Error("capture returned null");
    expect(tagged.card.title).toBe("someday");
    expect(tagged.card.due_at).toBeNull();

    expect(await captureTask(USER, "   ")).toBeNull();
  });
});
