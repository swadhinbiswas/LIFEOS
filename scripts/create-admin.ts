import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { auth } from "@/server/auth/index";
import { db } from "@/server/db";
import { boards, users } from "@/server/db/schema";
import { seedUser } from "@/server/seed/index";

/**
 * One-off: create a real, sign-in-able account for the dashboard and give it the demo dataset.
 *
 * The account is created through Better Auth's own `signUpEmail` rather than by inserting a row, so
 * the password is hashed by exactly the code path a real sign-up uses — no second hashing scheme,
 * no hand-rolled credential row. `email_verified` is then set directly because the app requires
 * verification before sign-in (spec §10) and there is no mail transport configured here to click a
 * link in; the alternative is leaving the owner unable to log in to their own database.
 *
 * The password is generated, printed once, and never stored anywhere in the repo.
 */

const EMAIL = "admin@lifeos.local";
const NAME = "Admin";

async function main(): Promise<void> {
  const password = randomBytes(18).toString("base64url");

  // Always recreate rather than reuse. The point of this script is to mint a password the operator
  // can actually type, and a reused account keeps whatever password it already had — so the old
  // "reuse" path printed a freshly generated secret that had never been applied to anything. That
  // is worse than printing nothing: it looks like a working credential and is not one.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);
  if (existing[0]) {
    console.log(`[admin] ${EMAIL} exists — removing it so a known password can be set`);
    await db.delete(users).where(eq(users.id, existing[0].id));
  }

  try {
    await auth.api.signUpEmail({ body: { email: EMAIL, password, name: NAME } });
  } catch (error) {
    console.error("[admin] signUpEmail failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);
  if (!row) {
    console.error("[admin] user row missing after signUpEmail");
    process.exit(1);
  }
  const userId: string = row.id;
  console.log(`[admin] created ${EMAIL}`);

  await db
    .update(users)
    // The schema uses snake_case property names (`email_verified`, `onboarded_at`), not camelCase.
    .set({ email_verified: true, onboarded_at: new Date() })
    .where(eq(users.id, userId));

  const boardCount = await db.$count(
    db
      .select()
      .from(boards)
      .where(eq(boards.user_id, userId as string)),
  );

  if (boardCount === 0) {
    const summary = await seedUser(userId as string, "developer");
    console.log(`[admin] seeded: ${JSON.stringify(summary)}`);
  } else {
    console.log(`[admin] already has ${boardCount} board(s); left the data alone`);
  }

  console.log("");
  console.log("  ── sign in with ──");
  console.log(`  email    : ${EMAIL}`);
  console.log(`  password : ${password}`);
  console.log("  ── shown once, not stored anywhere ──");
}

main().catch((error: unknown) => {
  console.error("[admin] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
