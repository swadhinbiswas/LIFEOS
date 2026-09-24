"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";

import { getTags, setTags } from "./index";

/** Tag adapters (spec §7.2): normalization and ownership live in the service. */

const setNoteTagsInput = z.object({
  noteId: z.string().min(1).max(64),
  tags: z.array(z.string().max(60)).max(50),
});

const cardInput = z.object({ cardId: z.string().min(1).max(64) });
const setCardTagsInput = z.object({
  cardId: z.string().min(1).max(64),
  tags: z.array(z.string().max(60)).max(50),
});

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[tags] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function setNoteTagsAction(input: unknown): Promise<ActionResult<string[]>> {
  return run((userId) => {
    const { noteId, tags } = setNoteTagsInput.parse(input);
    return setTags(userId, { type: "note", id: noteId, names: tags });
  });
}

export async function getCardTagsAction(input: unknown): Promise<ActionResult<string[]>> {
  return run((userId) => getTags(userId, "card", cardInput.parse(input).cardId));
}

export async function setCardTagsAction(input: unknown): Promise<ActionResult<string[]>> {
  return run((userId) => {
    const { cardId, tags } = setCardTagsInput.parse(input);
    return setTags(userId, { type: "card", id: cardId, names: tags });
  });
}
