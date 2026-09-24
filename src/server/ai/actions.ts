"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/server/auth";
import { getAiPrefs, saveAiPrefs } from "@/server/settings";

import { deleteCredential, saveCredential } from "./credentials";
import { AI_PROVIDERS, aiPrefsSchema } from "./prefs";
import { resolveModel } from "./providers";

/**
 * Server-Action adapters for the AI settings (spec §7.2/§8): the same services the page reads.
 * Provider keys enter here and are encrypted immediately (ADR-074); nothing returns a plaintext.
 */

const providerSchema = z.enum(AI_PROVIDERS);

const credentialInput = z.object({
  provider: providerSchema,
  key: z.string().trim().min(8).max(400),
  model: z.string().trim().min(1).max(200).optional(),
});

export async function saveCredentialAction(
  input: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = credentialInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "check the provider and key" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  try {
    await saveCredential(session.user.id, parsed.data);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "could not save the key",
    };
  }
}

export async function deleteCredentialAction(
  input: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = z.object({ provider: providerSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "unknown provider" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  await deleteCredential(session.user.id, parsed.data.provider);
  return { ok: true };
}

export async function saveAiPrefsAction(
  input: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = aiPrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "check the preferences" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  await saveAiPrefs(session.user.id, parsed.data);
  return { ok: true };
}

/** Whether a usable model resolves right now — the page's hint without exposing any secret. */
export async function aiStatusAction(): Promise<{
  ok: boolean;
  message?: string;
  source?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };
  const resolved = await resolveModel(session.user.id, await getAiPrefs(session.user.id));
  return resolved ? { ok: true, source: resolved.source } : { ok: false, message: "no provider" };
}
