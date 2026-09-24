"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";

import { createWebhook, deleteWebhook, retryDelivery, WEBHOOK_EVENTS } from "./index";

/** Webhook adapters (spec §7.2): the service owns signing, delivery and the log. */

const createInput = z.object({
  url: z.url().max(2_000),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
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
    console.error("[webhooks] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function createWebhookAction(
  input: unknown,
): Promise<ActionResult<{ secret: string }>> {
  return run(async (userId) => {
    const { url, events } = createInput.parse(input);
    const row = await createWebhook(userId, { url, events });
    return { secret: row.secret };
  });
}

export async function deleteWebhookAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deleteWebhook(userId, idInput.parse(input).id);
    return null;
  });
}

export async function retryWebhookAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const sent = await retryDelivery(userId, idInput.parse(input).id);
    if (!sent) throw new Error("delivery not found");
    return null;
  });
}
