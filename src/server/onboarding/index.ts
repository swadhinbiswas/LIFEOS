import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/**
 * Onboarding state (spec §14 Phase 8, ADR-085). This is the only application writer of
 * `users.onboarded_at` — an ERD-extra column; Better Auth owns the rest of the row.
 */

export async function isOnboarded(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ at: users.onboarded_at })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.at != null;
}

export async function markOnboarded(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ onboarded_at: new Date(), updated_at: new Date() })
    .where(eq(users.id, userId));
}
