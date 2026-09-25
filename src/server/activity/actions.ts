"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/server/auth";
import { getRegionalSettings } from "@/server/settings";

import { deleteConnection, saveConnection, syncWakaTime, WAKATIME_PROVIDER } from "./wakatime";

/**
 * Server-Action adapters for activity tracking (spec §7.2, ADR-110): the same services the
 * dashboard reads. The key arrives here and is encrypted immediately; nothing returns it in
 * plaintext, and the response carries only a masked hint.
 */

const keyInput = z.object({
  key: z.string().trim().min(8).max(400),
});

export interface SyncOutcome {
  ok: boolean;
  message?: string;
  days?: number;
}

export async function saveWakaTimeKeyAction(
  input: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = keyInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "that key looks too short" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  try {
    await saveConnection(session.user.id, parsed.data.key);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "could not store the key",
    };
  }
}

export async function deleteWakaTimeKeyAction(): Promise<{ ok: boolean }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false };
  await deleteConnection(session.user.id);
  return { ok: true };
}

/**
 * Pull the last 30 days. The window is fixed rather than passed in so an action cannot be used to
 * ask the provider for an arbitrarily large range, and the timeout lives in the service.
 */
export async function syncWakaTimeAction(): Promise<SyncOutcome> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  const regional = await getRegionalSettings(session.user.id);
  const result = await syncWakaTime(session.user.id, 30, new Date(), regional.timeZone);
  if (!result.ok) {
    return { ok: false, message: result.error ?? `${WAKATIME_PROVIDER} sync failed` };
  }
  return { ok: true, days: result.days };
}
