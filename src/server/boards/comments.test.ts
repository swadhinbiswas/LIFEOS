/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database, and the assignment must precede any import
// that reaches src/env.ts (which loads .env but never overrides a set variable).
process.env.DATABASE_URL = "file:.data/comments-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/comments-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { BoardError, createBoard, createCard, getBoard } = await import("./index");
const { addComment, listComments, removeComment } = await import("./comments");

const USER = "01HTESTUSER0000000000000031";
const OTHER_USER = "01HTESTUSER0000000000000032";

const newUser = (id: string) => ({
  id,
  email: `${id}@example.test`,
  name: id,
  created_at: new Date(),
  updated_at: new Date(),
});

async function freshCard(userId = USER): Promise<string> {
  const board = await createBoard(userId, { name: `comment board ${Math.random()}` });
  const payload = await getBoard(userId, board.id);
  const card = await createCard(userId, {
    boardId: board.id,
    columnId: payload.columns[0]!.id,
    title: "discuss this",
  });
  return card.id;
}

describe("card comments (spec §6.1)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values([newUser(USER), newUser(OTHER_USER)]);
  });

  it("starts empty, appends in the order written, and stamps the actor", async () => {
    const cardId = await freshCard();
    expect(await listComments(USER, cardId)).toEqual([]);

    await addComment(USER, cardId, "first thought");
    const after = await addComment(USER, cardId, "second thought");
    expect(after.map((comment) => comment.body)).toEqual(["first thought", "second thought"]);
    expect(after[0]?.actor).toBe("user");
  });

  it("keeps the body exactly as written, including whitespace", async () => {
    // Rendered as text, not HTML or Markdown, so the stored body is the display — newlines and all.
    const cardId = await freshCard();
    const body = "line one\n\nline two";
    const [stored] = await addComment(USER, cardId, body);
    expect(stored?.body).toBe(body);
  });

  it("removes a comment and leaves the rest in order", async () => {
    const cardId = await freshCard();
    await addComment(USER, cardId, "keep me");
    const withSecond = await addComment(USER, cardId, "delete me");

    const removed = await removeComment(USER, withSecond[1]!.id);
    expect(removed.map((comment) => comment.body)).toEqual(["keep me"]);
  });

  it("is tenant-scoped: another user cannot read, write or delete on the card", async () => {
    const cardId = await freshCard();
    const [comment] = await addComment(USER, cardId, "private");

    await expect(listComments(OTHER_USER, cardId)).rejects.toBeInstanceOf(BoardError);
    await expect(addComment(OTHER_USER, cardId, "intrusion")).rejects.toBeInstanceOf(BoardError);
    await expect(removeComment(OTHER_USER, comment!.id)).rejects.toBeInstanceOf(BoardError);

    expect((await listComments(USER, cardId)).map((entry) => entry.body)).toEqual(["private"]);
  });
});
