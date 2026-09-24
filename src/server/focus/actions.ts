"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import { startSession, stopSession } from "@/server/focus";

const startInput = z.object({
  plannedMin: z.number().int().min(1).max(600).nullable().optional(),
  cardId: z.string().min(1).nullable().optional(),
});

const stopInput = z.object({ sessionId: z.string().min(1) });

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[focus] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function startFocusAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await startSession(userId, startInput.parse(input ?? {}));
    return null;
  });
}

export async function stopFocusAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await stopSession(userId, stopInput.parse(input).sessionId);
    return null;
  });
}
