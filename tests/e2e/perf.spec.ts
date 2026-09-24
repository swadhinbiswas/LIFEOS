import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import { generateNKeysBetween } from "fractional-indexing";
import { ulid } from "ulid";

import { createVerifiedUser, signIn, uniqueEmail } from "./helpers";

const E2E_DB_URL = "file:tests/e2e/.e2e.db";

/**
 * Seed cards straight into the harness database. This is a *test fixture*, not demo data:
 * it exists so the acceptance line ("drag 500 cards smoothly") can be measured, and it is
 * never part of the app or its seeds (spec §12 governs shipped seed data, not test setup).
 */
async function seedCards(email: string, count: number): Promise<void> {
  const db = createClient({ url: E2E_DB_URL });
  try {
    const user = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });
    const userId = String(user.rows[0]?.["id"] ?? "");
    if (!userId) throw new Error(`no user for ${email}`);

    const board = await db.execute({
      sql: "SELECT id FROM boards WHERE user_id = ? AND is_system = 1",
      args: [userId],
    });
    const boardId = String(board.rows[0]?.["id"] ?? "");
    if (!boardId) throw new Error("the system Tasks board was not created");

    const column = await db.execute({
      sql: "SELECT id FROM board_columns WHERE board_id = ? AND name = 'Inbox'",
      args: [boardId],
    });
    const columnId = String(column.rows[0]?.["id"] ?? "");
    if (!columnId) throw new Error("the Inbox column was not created");

    const last = await db.execute({
      sql: "SELECT position FROM cards WHERE column_id = ? ORDER BY position DESC LIMIT 1",
      args: [columnId],
    });
    const lastPosition = last.rows[0]?.["position"];
    const keys = generateNKeysBetween(
      lastPosition === undefined || lastPosition === null ? null : String(lastPosition),
      null,
      count,
    );

    const now = Date.now();
    await db.batch(
      keys.map((position, index) => ({
        sql: `INSERT INTO cards
                (id, board_id, column_id, user_id, position, title, version, kind, is_demo, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 1, 'task', 0, ?, ?)`,
        args: [ulid(), boardId, columnId, userId, position, `seeded card ${index + 1}`, now, now],
      })),
      "write",
    );
  } finally {
    db.close();
  }
}

/**
 * Phase 2 acceptance: a board with 500 cards stays usable. Virtualized columns bound the
 * rendered DOM; the assertions here are the DOM bound (stable) plus a generous interaction
 * budget (guards against an unbounded render, not against machine speed).
 */
test("500 cards render bounded and stay interactive", async ({ page }) => {
  test.setTimeout(180_000);
  const email = uniqueEmail("perf");

  await createVerifiedUser(page, email);
  await signIn(page, email);
  await page.goto("/tasks"); // creates the system board + Inbox column
  const columnName = "Inbox";

  await seedCards(email, 500);

  const started = Date.now();
  await page.goto("/tasks");
  await expect(page.getByRole("status").first()).toContainText("500 cards");
  expect(Date.now() - started).toBeLessThan(20_000);

  // The long column virtualizes: far fewer cards in the DOM than in the data.
  const inbox = page.locator(`section[data-slot="board-column"][data-column-name="${columnName}"]`);
  await expect(inbox.locator('[data-slot="card"]').first()).toBeVisible();
  const rendered = await inbox.locator('[data-slot="card"]').count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(150);

  // Still interactive at 500: keyboard focus moves and the quick-add lands a new card.
  // The new card lands at the bottom of the virtualized column, so the count is the signal
  // (asserting on its DOM node would fail exactly because it is virtualized away).
  await page.keyboard.press("n");
  await page.keyboard.type("one more");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").first()).toContainText("501 cards");

  await page.getByLabel(`add a card to ${columnName}`).blur();
  await page.keyboard.press("j");
  await expect(page.locator('[data-slot="card"][data-focused="true"]')).toHaveCount(1);
});
