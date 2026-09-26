import { eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/**
 * Local development login (docs/SELF_HOSTING.md). Creates a verified account with a known password,
 * so `pnpm dev` + sign-in works without going through the email-verification outbox. Development
 * only — never run against a shared database.
 *
 *   pnpm tsx scripts/dev-login.ts [email] [password]
 *
 * It used to fill the account with the Developer sample data. That is gone with the seed module
 * (ADR-123): the account is created empty, and someone who has just made an account has not done a
 * month's worth of work yet, so a dashboard full of invented history was the wrong thing to show.
 * Add real data through the app.
 */

const email = process.argv[2] ?? "you@lifeos.local";
const password = process.argv[3] ?? "lifeos-demo-1234";

async function main(): Promise<void> {
  let [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!row) {
    await auth.api.signUpEmail({ body: { email, password, name: "You" } });
    [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  }
  if (!row) throw new Error("could not create the account");

  await db
    .update(users)
    .set({ email_verified: true, onboarded_at: new Date(), updated_at: new Date() })
    .where(eq(users.id, row.id));

  console.info(`[dev-login] email:    ${email}`);
  console.info(`[dev-login] password: ${password}`);
  console.info("[dev-login] ready - the account is empty; add data through the app");
}

main().catch((error: unknown) => {
  console.error("[dev-login] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
