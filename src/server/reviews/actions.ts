"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import { completeReview } from "@/server/reviews";

const answers = z.object({
  wins: z.string().max(20_000),
  lessons: z.string().max(20_000),
  next: z.string().max(20_000),
  clearedInbox: z.boolean(),
  reviewedBoards: z.boolean(),
  reviewedGoals: z.boolean(),
});

const input = z.object({
  period: z.enum(["weekly", "monthly"]),
  answers,
});

export async function completeReviewAction(
  input_: unknown,
): Promise<ActionResult<{ noteId: string | null }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    const parsed = input.parse(input_);
    const review = await completeReview(session.user.id, parsed);
    return { ok: true, data: { noteId: review.note_id } };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[reviews] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}
