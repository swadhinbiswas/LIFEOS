import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "@/env";

/**
 * At-rest secret encryption (ADR-074): AES-256-GCM with an app-level key.
 *
 * Provider keys are decrypted only inside the server-side model factory (ADR-075); the
 * ciphertext never leaves the database and the plaintext never reaches a component or a Server
 * Action payload. The key is 32 bytes from `AI_ENCRYPTION_KEY` (base64 or hex). Absent outside
 * production we derive a deterministic dev key from `BETTER_AUTH_SECRET` so tests and local runs
 * work; absent in production nothing can be saved (the settings page says so) rather than
 * silently storing a weaker cipher.
 */

const ALGORITHM = "aes-256-gcm";
const DEV_SALT = "lifeos.ai.encryption.v1";

function decodeKey(raw: string): Buffer {
  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) return base64;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  throw new Error("AI_ENCRYPTION_KEY must be 32 bytes, base64- or hex-encoded");
}

/** The 32-byte key, or null when production has no `AI_ENCRYPTION_KEY`. */
export function resolveEncryptionKey(): Buffer | null {
  if (env.AI_ENCRYPTION_KEY) return decodeKey(env.AI_ENCRYPTION_KEY);
  if (process.env.NODE_ENV !== "production") {
    // Documented dev/test fallback (ADR-074): deterministic, never used in production.
    return createHash("sha256").update(`${env.BETTER_AUTH_SECRET}:${DEV_SALT}`).digest();
  }
  return null;
}

/** True when a secret can be stored right now (real key, or the dev/test fallback). */
export function isEncryptionConfigured(): boolean {
  return resolveEncryptionKey() !== null;
}

/** `iv.tag.ciphertext`, each base64. */
export function encryptSecret(plaintext: string): string {
  const key = resolveEncryptionKey();
  if (!key) throw new Error("AI encryption is not configured (set AI_ENCRYPTION_KEY)");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

/** Throws on a tampered payload — GCM authentication is the point. */
export function decryptSecret(payload: string): string {
  const key = resolveEncryptionKey();
  if (!key) throw new Error("AI encryption is not configured (set AI_ENCRYPTION_KEY)");
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("malformed encrypted secret");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** The only part of a secret the client ever sees: its last four characters. */
export function maskSecret(plaintext: string): string {
  return plaintext.length <= 4 ? "••••" : `••••${plaintext.slice(-4)}`;
}
