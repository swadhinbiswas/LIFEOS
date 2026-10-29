import { eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { encryptSecret, decryptSecret } from "@/server/ai/crypto";
import { db } from "@/server/db";
import { email_accounts, email_cache } from "@/server/db/schema";

export interface EmailAccountView {
  id: string;
  host: string;
  port: number;
  username: string;
  mailbox: string;
  connectedAt: Date;
}

export interface EmailAccountSecrets {
  host: string;
  port: number;
  username: string;
  password: string;
  mailbox: string;
}

export async function connectEmailAccount(
  userId: string,
  input: { host: string; port: number; username: string; password: string; mailbox?: string },
): Promise<EmailAccountView> {
  // Replace any existing account for this user — one mailbox at a time (matches the reference).
  await db.delete(email_accounts).where(eq(email_accounts.user_id, userId));
  await db.delete(email_cache).where(eq(email_cache.user_id, userId));

  const [row] = await db
    .insert(email_accounts)
    .values({
      id: newId(),
      user_id: userId,
      host: input.host.trim(),
      port: input.port,
      username: input.username.trim(),
      password_encrypted: encryptSecret(input.password),
      mailbox: input.mailbox?.trim() || "INBOX",
    })
    .returning();
  if (!row) throw new Error("email account insert returned no row");
  return {
    id: row.id,
    host: row.host,
    port: row.port,
    username: row.username,
    mailbox: row.mailbox,
    connectedAt: row.created_at,
  };
}

export async function disconnectEmailAccount(userId: string): Promise<void> {
  await db.delete(email_accounts).where(eq(email_accounts.user_id, userId));
  await db.delete(email_cache).where(eq(email_cache.user_id, userId));
}

export async function getEmailAccount(userId: string): Promise<EmailAccountView | null> {
  const [row] = await db
    .select()
    .from(email_accounts)
    .where(eq(email_accounts.user_id, userId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    host: row.host,
    port: row.port,
    username: row.username,
    mailbox: row.mailbox,
    connectedAt: row.created_at,
  };
}

export async function getEmailAccountSecrets(userId: string): Promise<EmailAccountSecrets | null> {
  const [row] = await db
    .select()
    .from(email_accounts)
    .where(eq(email_accounts.user_id, userId))
    .limit(1);
  if (!row) return null;
  return {
    host: row.host,
    port: row.port,
    username: row.username,
    password: decryptSecret(row.password_encrypted),
    mailbox: row.mailbox,
  };
}

export async function getEmailCache(userId: string) {
  const [row] = await db.select().from(email_cache).where(eq(email_cache.user_id, userId)).limit(1);
  return row ?? null;
}

export async function saveEmailCache(userId: string, messages: unknown[]): Promise<void> {
  const existing = await getEmailCache(userId);
  if (existing) {
    await db
      .update(email_cache)
      .set({
        fetched_at: new Date(),
        messages_json: JSON.stringify(messages),
        updated_at: new Date(),
      })
      .where(eq(email_cache.user_id, userId));
  } else {
    await db.insert(email_cache).values({
      id: newId(),
      user_id: userId,
      fetched_at: new Date(),
      messages_json: JSON.stringify(messages),
    });
  }
}

export async function saveEmailSummary(
  userId: string,
  date: string,
  summary: unknown,
): Promise<void> {
  const existing = await getEmailCache(userId);
  if (existing) {
    await db
      .update(email_cache)
      .set({
        summary_date: date,
        summary_at: new Date(),
        summary_json: JSON.stringify(summary),
        updated_at: new Date(),
      })
      .where(eq(email_cache.user_id, userId));
  } else {
    await db.insert(email_cache).values({
      id: newId(),
      user_id: userId,
      fetched_at: new Date(),
      messages_json: "[]",
      summary_date: date,
      summary_at: new Date(),
      summary_json: JSON.stringify(summary),
    });
  }
}
