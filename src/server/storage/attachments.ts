import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { env } from "@/env";

/**
 * Attachment bytes (ADR-140). Local-first: files live on the filesystem under a single directory
 * (`ATTACHMENTS_DIR`, default `/data/attachments`) so a self-hoster backs them up with the
 * database volume. An S3-compatible backend is a future addition behind the same interface.
 *
 * The storage key is a *relative* path; every read/write resolves it against the root and refuses
 * to escape it. A key is never a URL and never contains `..`.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB — generous for documents, hostile to abuse.

export const ATTACHMENT_MAX_BYTES = MAX_BYTES;

export function attachmentsRoot(): string {
  return env.ATTACHMENTS_DIR ?? "/data/attachments";
}

/** Sanitise a filename for storage: keep alphanumerics, dot, dash, underscore; collapse the rest. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "file";
}

/** Build a storage key for a new attachment. Flat per-attachment directory, no user in the path. */
export function buildStorageKey(attachmentId: string, fileName: string): string {
  return `${attachmentId}/${safeFileName(fileName)}`;
}

function resolveKey(key: string): string {
  const root = resolve(attachmentsRoot());
  const full = resolve(root, key);
  // Containment check: the resolved path must start with root + separator.
  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error("invalid storage key");
  }
  return full;
}

export async function saveAttachmentBytes(key: string, bytes: Uint8Array): Promise<void> {
  if (bytes.byteLength > MAX_BYTES) throw new Error("file too large");
  const full = resolveKey(key);
  await mkdir(full.substring(0, full.lastIndexOf(sep)), { recursive: true });
  await writeFile(full, bytes);
}

export async function readAttachmentBytes(key: string): Promise<Buffer> {
  const full = resolveKey(key);
  return readFile(full);
}

export async function deleteAttachmentBytes(key: string): Promise<void> {
  const full = resolveKey(key);
  await rm(full, { force: true });
  // Best-effort: remove the now-empty per-attachment directory.
  const dir = full.substring(0, full.lastIndexOf(sep));
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}
