"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/server/auth";
import {
  accountDeletionStatus,
  cancelAccountDeletion,
  requestAccountDeletion,
  type DeletionStatus,
} from "@/server/data/account";
import { importData, type ImportReport } from "@/server/data/import";

/**
 * Data-ownership Server Actions (spec §10, ADR-083): import a JSON export, and schedule or cancel
 * account deletion. Every action acts only on the signed-in user.
 */

export type ImportResult = { ok: true; report: ImportReport } | { ok: false; message: string };

const importInput = z.object({ contents: z.string().min(1).max(20_000_000) });

export async function importDataAction(input: unknown): Promise<ImportResult> {
  const parsed = importInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "that file is empty or too large" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  let payload: unknown;
  try {
    payload = JSON.parse(parsed.data.contents);
  } catch {
    return { ok: false, message: "that file is not valid JSON" };
  }

  try {
    return { ok: true, report: await importData(session.user.id, payload) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "import failed" };
  }
}

export async function requestDeletionAction(): Promise<{ ok: boolean; status?: DeletionStatus }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false };
  return { ok: true, status: await requestAccountDeletion(session.user.id) };
}

export async function cancelDeletionAction(): Promise<{ ok: boolean; status?: DeletionStatus }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false };
  await cancelAccountDeletion(session.user.id);
  return { ok: true, status: await accountDeletionStatus(session.user.id) };
}
