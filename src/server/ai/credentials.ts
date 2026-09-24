import { and, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { ai_credentials } from "@/server/db/schema";

import { decryptSecret, encryptSecret, isEncryptionConfigured, maskSecret } from "./crypto";
import type { AiProvider } from "./prefs";

/**
 * BYO provider credentials (spec §8/§10, ADR-074). This is the only writer of `ai_credentials`,
 * and it never returns plaintext to a caller except the server-side model factory, which asks for
 * exactly one provider's key via `getDecryptedCredential`.
 */

export interface CredentialSummary {
  id: string;
  provider: string;
  /** Last four characters — the only part ever shown. */
  hint: string;
  model: string | null;
  created_at: Date;
  updated_at: Date;
}

const toSummary = (row: typeof ai_credentials.$inferSelect): CredentialSummary => ({
  id: row.id,
  provider: row.provider,
  hint: row.hint,
  model: row.model,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

/** Store (or replace) a provider key. Throws when encryption is unavailable (production). */
export async function saveCredential(
  userId: string,
  input: { provider: AiProvider; key: string; model?: string | null },
): Promise<CredentialSummary> {
  if (!isEncryptionConfigured()) {
    throw new Error("provider keys cannot be stored: AI_ENCRYPTION_KEY is not set");
  }
  const key = input.key.trim();
  if (key.length < 8) throw new Error("that key looks too short");

  const values = {
    id: newId(),
    user_id: userId,
    provider: input.provider,
    secret_encrypted: encryptSecret(key),
    hint: maskSecret(key),
    model: input.model ?? null,
  };

  const [row] = await db
    .insert(ai_credentials)
    .values(values)
    .onConflictDoUpdate({
      target: [ai_credentials.user_id, ai_credentials.provider],
      set: {
        secret_encrypted: values.secret_encrypted,
        hint: values.hint,
        model: values.model,
        updated_at: new Date(),
      },
    })
    .returning();

  if (!row) throw new Error("could not save the provider key");
  return toSummary(row);
}

/** Masked summaries for the settings page. Never includes the ciphertext or the plaintext. */
export async function listCredentials(userId: string): Promise<CredentialSummary[]> {
  const rows = await db.select().from(ai_credentials).where(eq(ai_credentials.user_id, userId));
  return rows.map(toSummary);
}

/** Decrypt one provider's key. Server-side only — never call this from a component. */
export async function getDecryptedCredential(
  userId: string,
  provider: AiProvider,
): Promise<{ key: string; model: string | null } | null> {
  const rows = await db
    .select()
    .from(ai_credentials)
    .where(and(eq(ai_credentials.user_id, userId), eq(ai_credentials.provider, provider)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { key: decryptSecret(row.secret_encrypted), model: row.model };
}

export async function deleteCredential(userId: string, provider: AiProvider): Promise<void> {
  await db
    .delete(ai_credentials)
    .where(and(eq(ai_credentials.user_id, userId), eq(ai_credentials.provider, provider)));
}
