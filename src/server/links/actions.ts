"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";

import {
  createCardLink,
  deleteCardLink,
  listCardLinks,
  listCardOptions,
  LINK_KINDS,
} from "./index";
import type { CardLinkView } from "./index";

/** Card-link adapters (spec §7.2): same discriminated-result shape as every other action. */

const cardInput = z.object({ cardId: z.string().min(1).max(64) });
const linkInput = z.object({
  srcId: z.string().min(1).max(64),
  dstId: z.string().min(1).max(64),
  kind: z.enum(LINK_KINDS),
});
const linkIdInput = z.object({ linkId: z.string().min(1).max(64) });

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[links] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function listCardLinksAction(input: unknown): Promise<ActionResult<CardLinkView[]>> {
  return run((userId) => listCardLinks(userId, cardInput.parse(input).cardId));
}

export async function listCardOptionsAction(
  input: unknown,
): Promise<ActionResult<Array<{ id: string; title: string }>>> {
  return run((userId) => listCardOptions(userId, cardInput.parse(input).cardId));
}

export async function createCardLinkAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await createCardLink(userId, linkInput.parse(input));
    return null;
  });
}

export async function deleteCardLinkAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deleteCardLink(userId, linkIdInput.parse(input).linkId);
    return null;
  });
}
