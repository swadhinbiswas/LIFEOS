"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/server/auth";
import { getAiPrefs, saveAiPrefs } from "@/server/settings";

import { regenerateBrief } from "./brief";
import { fetchCommandCodeModels, shapeFor, type CommandCodeShape } from "./commandcode";
import { deleteCredential, getDecryptedCredential, saveCredential } from "./credentials";
import { addMemory, deleteMemory, updateMemory } from "./memory";
import { AI_PROVIDERS, aiPrefsSchema } from "./prefs";
import { platformKey, resolveModel } from "./providers";

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

/**
 * The models this account can actually reach on Command Code, read from their live catalog.
 *
 * The key never leaves the server: it is the user's own decrypted credential, falling back to the
 * operator's platform key, and only model ids come back (ADR-074). That is the whole reason this is
 * a server action rather than a fetch from the settings form.
 *
 * The point is to offer models that are **real**. Their catalog is the only trustworthy list — a
 * hardcoded one is wrong by their next release, and inventing model names is exactly what spec §1
 * forbids. Returns an empty list rather than throwing when the key is missing or rejected, so the
 * model field stays a free-text box the user can always type into.
 */
export async function listCommandCodeModelsAction(): Promise<{
  ok: boolean;
  models?: Array<{ id: string; shape: CommandCodeShape; fromCatalog: boolean }>;
  message?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  const credential = await getDecryptedCredential(session.user.id, "commandcode");
  const key = credential?.key ?? platformKey("commandcode");
  if (!key) return { ok: false, message: "no Command Code key is configured" };

  const catalog = await fetchCommandCodeModels(key);
  if (catalog.length === 0) {
    return { ok: false, message: "could not read the model list — check the key" };
  }
  return {
    ok: true,
    models: catalog.map((model) => {
      const { shape, fromCatalog } = shapeFor(model.id, catalog);
      return { id: model.id, shape, fromCatalog };
    }),
  };
}

/**
 * Make one tiny real call so a user can verify a live key works (spec §8). It resolves the same
 * way a chat does — BYO first, then platform — and reports the provider/model on success.
 */
export async function testAiConnectionAction(): Promise<{
  ok: boolean;
  message?: string;
  provider?: string;
  model?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  const prefs = await getAiPrefs(session.user.id);
  const resolved = await resolveModel(session.user.id, prefs);
  if (!resolved) return { ok: false, message: "no provider is configured" };

  try {
    const { generateText } = await import("ai");
    const result = await generateText({ model: resolved.model, prompt: "Reply with: ok" });
    return {
      ok: true,
      provider: resolved.provider,
      model: resolved.modelId,
      message: result.text.slice(0, 80),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "the provider call failed",
    };
  }
}

const memoryInput = z.object({ content: z.string().trim().min(1).max(500) });

export async function addMemoryAction(input: unknown): Promise<{ ok: boolean; message?: string }> {
  const parsed = memoryInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "a memory cannot be empty" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  await addMemory(session.user.id, parsed.data.content);
  return { ok: true };
}

export async function updateMemoryAction(
  input: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = memoryInput.extend({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "a memory cannot be empty" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  const updated = await updateMemory(session.user.id, parsed.data.id, parsed.data.content);
  return updated ? { ok: true } : { ok: false, message: "that memory no longer exists" };
}

export async function deleteMemoryAction(
  input: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "unknown memory" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  await deleteMemory(session.user.id, parsed.data.id);
  return { ok: true };
}

/**
 * Re-run the morning brief on demand (ADR-106). The only path that may replace a brief the cron
 * already wrote, and it is always the user's own click.
 */
export async function regenerateBriefAction(): Promise<{
  ok: boolean;
  message?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  const result = await regenerateBrief(session.user.id);
  if (result.ok) return { ok: true };
  // "no provider configured" is the one failure a user can act on, so it gets a pointer.
  return {
    ok: false,
    message:
      result.reason === "no provider configured"
        ? "no AI provider is configured"
        : "could not write a brief",
  };
}
