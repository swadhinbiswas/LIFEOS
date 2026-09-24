"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";

import { clearReminder, getReminder, setReminder } from "./index";

/** Reminder adapters (spec §7.2): same discriminated-result shape as every other action. */

const cardInput = z.object({ cardId: z.string().min(1).max(64) });
const setInput = z.object({ cardId: z.string().min(1).max(64), fireAt: z.coerce.date() });

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[reminders] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function getCardReminderAction(
  input: unknown,
): Promise<ActionResult<{ fireAt: string } | null>> {
  return run(async (userId) => {
    const row = await getReminder(userId, "card", cardInput.parse(input).cardId);
    return row ? { fireAt: new Date(row.fire_at).toISOString() } : null;
  });
}

export async function setCardReminderAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const { cardId, fireAt } = setInput.parse(input);
    await setReminder(userId, { entityType: "card", entityId: cardId, fireAt });
    return null;
  });
}

export async function clearCardReminderAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await clearReminder(userId, "card", cardInput.parse(input).cardId);
    return null;
  });
}
