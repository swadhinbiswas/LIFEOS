"use server";

import { ZodError, z } from "zod";

import type { ActionResult } from "@/server/boards/actions";
import { getServerSession } from "@/server/auth/session";
import { completeReview } from "@/server/reviews";

import { draftReview, type ReviewPeriod } from "./draft";

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

/**
 * Draft the three answers (spec §6.2 "pre-filled by AI on request", ADR-116).
 *
 * Returns text and writes nothing: the wizard puts it in the form and the user edits it, so the
 * review that is saved is theirs. A model that returns something unusable reports a reason instead
 * of three half-empty textareas.
 */
export async function draftReviewAction(
  input_: unknown,
): Promise<ActionResult<{ wins: string; lessons: string; next: string }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };

  const parsed = z.object({ period: z.enum(["weekly", "monthly"]) }).safeParse(input_);
  if (!parsed.success) {
    return { ok: false, code: "invalid", message: "that cadence is not one we have" };
  }

  try {
    const result = await draftReview(session.user.id, parsed.data.period as ReviewPeriod);
    if (!result.ok) {
      return { ok: false, code: "conflict", message: result.reason };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error("[reviews] draft failed", error);
    return { ok: false, code: "conflict", message: "the draft could not be written" };
  }
}
