"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";

import { API_SCOPES, createApiKey, revokeApiKey } from "./index";

/** API-key adapters (spec §7.2): hashing and scope validation live in the service. */

const createInput = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1).max(API_SCOPES.length),
  /** null/absent = no expiry. */
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
});

const idInput = z.object({ id: z.string().min(1).max(64) });

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[api-keys] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function createApiKeyAction(
  input: unknown,
): Promise<ActionResult<{ plaintext: string }>> {
  return run(async (userId) => {
    const { name, scopes, expiresInDays } = createInput.parse(input);
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null;
    const created = await createApiKey(userId, { name, scopes, expiresAt });
    return { plaintext: created.plaintext };
  });
}

export async function revokeApiKeyAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await revokeApiKey(userId, idInput.parse(input).id);
    return null;
  });
}
