"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import {
  BOOK_STATUSES,
  createBook,
  createCourse,
  setBookStatus,
  setCourseProgress,
} from "@/server/learning";

const courseInput = z.object({
  title: z.string().trim().min(1).max(300),
  provider: z.string().trim().max(120).nullable().optional(),
  url: z.string().trim().max(2_000).nullable().optional(),
});

const progressInput = z.object({
  courseId: z.string().min(1),
  progress: z.number().int().min(0).max(100),
});

const bookInput = z.object({
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().max(200).nullable().optional(),
});

const statusInput = z.object({ bookId: z.string().min(1), status: z.enum(BOOK_STATUSES) });

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[learning] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function createCourseAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await createCourse(userId, courseInput.parse(input));
    return null;
  });
}

export async function setCourseProgressAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await setCourseProgress(userId, progressInput.parse(input));
    return null;
  });
}

export async function createBookAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await createBook(userId, bookInput.parse(input));
    return null;
  });
}

export async function setBookStatusAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await setBookStatus(userId, statusInput.parse(input));
    return null;
  });
}
