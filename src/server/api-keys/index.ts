import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { api_keys } from "@/server/db/schema";

/**
 * Personal API keys (spec §9.1, ADR-062). A key is `lifeos_live_<prefix>_<secret>`; only the
 * SHA-256 hash and the prefix are stored, so a database leak yields no usable key. Verification
 * looks up by prefix (one indexed row) and compares the hash in constant time.
 */

export type ApiKeyRow = typeof api_keys.$inferSelect;

const TOKEN_PREFIX = "lifeos_live_";

/** The scopes a key may be granted (spec §9.1). `read:*` / `write:*` are wildcards. */
export const API_SCOPES = [
  "read:*",
  "write:tasks",
  "write:jobs",
  "write:notes",
  "admin:export",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

const parseScopes = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

/** Does a granted scope set allow a required scope? `read:*` grants every `read:…`. */
export function scopeAllows(scopes: string[], required: string): boolean {
  if (scopes.includes("*") || scopes.includes(required)) return true;
  const namespace = required.split(":")[0];
  return scopes.includes(`${namespace}:*`);
}

export interface CreatedApiKey {
  /** The full token, returned once and never stored. */
  plaintext: string;
  row: ApiKeyRow;
}

export async function createApiKey(
  userId: string,
  input: { name: string; scopes: string[]; expiresAt?: Date | null },
): Promise<CreatedApiKey> {
  const prefix = randomBytes(4).toString("hex"); // 8 hex chars
  const secret = randomBytes(24).toString("base64url");
  const plaintext = `${TOKEN_PREFIX}${prefix}_${secret}`;
  const key_hash = createHash("sha256").update(plaintext).digest("hex");

  const [row] = await db
    .insert(api_keys)
    .values({
      id: newId(),
      user_id: userId,
      name: input.name.trim(),
      prefix,
      key_hash,
      scopes: JSON.stringify(input.scopes),
      expires_at: input.expiresAt ?? null,
    })
    .returning();
  if (!row) throw new Error("api key insert returned no row");
  return { plaintext, row };
}

/** Keys the user can manage — never the token, only the prefix and metadata. */
export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  return db
    .select()
    .from(api_keys)
    .where(eq(api_keys.user_id, userId))
    .orderBy(desc(api_keys.created_at));
}

export async function revokeApiKey(
  userId: string,
  id: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(api_keys)
    .set({ revoked_at: now })
    .where(and(eq(api_keys.id, id), eq(api_keys.user_id, userId), isNull(api_keys.revoked_at)));
}

/** A safe view for the management UI: metadata only, never the token. */
export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export const toKeySummary = (row: ApiKeyRow): ApiKeySummary => ({
  id: row.id,
  name: row.name,
  prefix: row.prefix,
  scopes: parseScopes(row.scopes),
  revoked: Boolean(row.revoked_at),
  lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
});

export interface ApiKeyIdentity {
  keyId: string;
  userId: string;
  scopes: string[];
}

/** Resolve a bearer token to its owner and scopes, or null if unknown/revoked/expired. */
export async function verifyApiKey(
  token: string,
  now: Date = new Date(),
): Promise<ApiKeyIdentity | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const prefix = token.slice(TOKEN_PREFIX.length).split("_")[0];
  if (!prefix) return null;

  const [row] = await db.select().from(api_keys).where(eq(api_keys.prefix, prefix)).limit(1);
  if (!row || row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return null;

  const expected = Buffer.from(row.key_hash, "hex");
  const actual = Buffer.from(createHash("sha256").update(token).digest("hex"), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  await db.update(api_keys).set({ last_used_at: now }).where(eq(api_keys.id, row.id));

  return { keyId: row.id, userId: row.user_id, scopes: parseScopes(row.scopes) };
}
