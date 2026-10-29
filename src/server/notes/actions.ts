"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import { createNote, dailyNote, deleteNote, updateNote } from "@/server/notes";

const createInput = z.object({
  title: z.string().trim().max(300).optional(),
  body: z.string().max(200_000).optional(),
  kind: z.enum(["note", "daily", "journal"]).optional(),
  secret: z.boolean().optional(),
});

const updateInput = z.object({
  noteId: z.string().min(1),
  title: z.string().trim().max(300).optional(),
  body: z.string().max(200_000).optional(),
  pinned: z.boolean().optional(),
  secret: z.boolean().optional(),
});

const idInput = z.object({ noteId: z.string().min(1) });

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[notes] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function createNoteAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async (userId) => {
    const note = await createNote(userId, createInput.parse(input));
    return { id: note.id };
  });
}

export async function updateNoteAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await updateNote(userId, updateInput.parse(input));
    return null;
  });
}

export async function deleteNoteAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deleteNote(userId, idInput.parse(input).noteId);
    return null;
  });
}

export async function dailyNoteAction(): Promise<ActionResult<{ id: string }>> {
  return run(async (userId) => {
    const note = await dailyNote(userId);
    return { id: note.id };
  });
}
