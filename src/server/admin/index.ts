import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { accounts, users } from "@/server/db/schema";

export type UserSummary = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
};

export async function isAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.role === "admin";
}

export async function listUsers(): Promise<UserSummary[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.created_at,
    })
    .from(users)
    .orderBy(users.created_at);
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role ?? "user",
    createdAt: r.createdAt,
  }));
}

export async function createUser(
  actorId: string,
  input: { email: string; name: string; password: string; role?: "admin" | "user" },
): Promise<string> {
  if (!(await isAdmin(actorId))) throw new Error("not an admin");

  const email = input.email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) throw new Error("a user with that email already exists");

  // First user ever created becomes an admin regardless, so a fresh install is never locked out.
  const count = (await db.select({ id: users.id }).from(users)).length;
  const role = count === 0 ? "admin" : (input.role ?? "user");

  const userId = newId();
  const now = new Date();
  await db.insert(users).values({
    id: userId,
    email,
    name: input.name.trim(),
    email_verified: true,
    role,
    created_at: now,
    updated_at: now,
  });

  const hashed = await hashPassword(input.password);
  await db.insert(accounts).values({
    id: newId(),
    account_id: email,
    provider_id: "credential",
    user_id: userId,
    password: hashed,
    created_at: now,
    updated_at: now,
  });

  return userId;
}

export async function deleteUser(actorId: string, targetId: string): Promise<void> {
  if (!(await isAdmin(actorId))) throw new Error("not an admin");
  if (actorId === targetId) throw new Error("cannot delete yourself");
  await db.delete(users).where(eq(users.id, targetId));
}

export async function resetPassword(
  actorId: string,
  targetId: string,
  newPassword: string,
): Promise<void> {
  if (!(await isAdmin(actorId))) throw new Error("not an admin");
  const hashed = await hashPassword(newPassword);
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.user_id, targetId), eq(accounts.provider_id, "credential")))
    .limit(1);
  if (!account) throw new Error("user has no credential account");
  await db
    .update(accounts)
    .set({ password: hashed, updated_at: new Date() })
    .where(eq(accounts.id, account.id));
}

export async function setRole(
  actorId: string,
  targetId: string,
  role: "admin" | "user",
): Promise<void> {
  if (!(await isAdmin(actorId))) throw new Error("not an admin");
  if (actorId === targetId) throw new Error("cannot change your own role");
  await db.update(users).set({ role, updated_at: new Date() }).where(eq(users.id, targetId));
}
