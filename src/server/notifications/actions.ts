"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";

import { markAllNotificationsRead, markNotificationRead } from "./index";

/** Notification adapters (spec §7.2): same discriminated-result shape as every other action. */

const idInput = z.object({ id: z.string().min(1).max(64) });

async function run(fn: (userId: string) => Promise<void>): Promise<ActionResult<null>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    await fn(session.user.id);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[notifications] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function markNotificationReadAction(input: unknown): Promise<ActionResult<null>> {
  return run((userId) => markNotificationRead(userId, idInput.parse(input).id));
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<null>> {
  return run((userId) => markAllNotificationsRead(userId));
}
