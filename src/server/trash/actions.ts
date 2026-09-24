"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";

import { listTrash, purgeExpiredItems, purgeItem, restoreItem, type TrashPage } from "./index";

/** Trash adapters (spec §7.2): same discriminated-result shape as every other action. */

const itemInput = z.object({ kind: z.enum(["card", "note"]), id: z.string().min(1).max(64) });

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[trash] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function listTrashAction(): Promise<ActionResult<TrashPage>> {
  return run((userId) => listTrash(userId));
}

export async function restoreTrashItemAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const { kind, id } = itemInput.parse(input);
    await restoreItem(userId, kind, id);
    return null;
  });
}

export async function purgeTrashItemAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const { kind, id } = itemInput.parse(input);
    await purgeItem(userId, kind, id);
    return null;
  });
}

export async function purgeExpiredTrashAction(): Promise<ActionResult<{ removed: number }>> {
  return run(async (userId) => ({ removed: await purgeExpiredItems(userId) }));
}
