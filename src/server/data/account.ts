import { and, eq, isNotNull, lt, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/**
 * Account deletion with a grace period (spec §10, ADR-083). A request only records the intent and
 * an instant; the `CRON_SECRET`-guarded purge removes accounts whose grace period has passed, and
 * deleting the `users` row cascades to every table that references it.
 */

export const DELETION_GRACE_DAYS = 7;

const GRACE_MS = DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;

export interface DeletionStatus {
  requestedAt: Date | null;
  purgeAfter: Date | null;
}

export async function accountDeletionStatus(userId: string): Promise<DeletionStatus> {
  const [row] = await db
    .select({ requestedAt: users.deletion_requested_at })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const requestedAt = row?.requestedAt ?? null;
  return {
    requestedAt,
    purgeAfter: requestedAt ? new Date(requestedAt.getTime() + GRACE_MS) : null,
  };
}

export async function requestAccountDeletion(userId: string): Promise<DeletionStatus> {
  await db
    .update(users)
    .set({ deletion_requested_at: new Date(), updated_at: new Date() })
    .where(eq(users.id, userId));
  return accountDeletionStatus(userId);
}

export async function cancelAccountDeletion(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ deletion_requested_at: null, updated_at: new Date() })
    .where(eq(users.id, userId));
}

/** Delete every account whose grace period has expired. Returns how many were purged. */
export async function purgeExpiredAccounts(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - GRACE_MS);
  const purged = await db
    .delete(users)
    .where(and(isNotNull(users.deletion_requested_at), lt(users.deletion_requested_at, cutoff)))
    .returning({ id: users.id });
  return purged.length;
}

/** Accounts scheduled for deletion, for the health surface and the report. */
export async function pendingDeletionCount(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(users)
    .where(isNotNull(users.deletion_requested_at));
  return Number(row?.value ?? 0);
}
