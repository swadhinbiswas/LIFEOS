"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import {
  createGoal,
  createKeyResult,
  linkToGoal,
  setKeyResultValue,
  updateGoal,
} from "@/server/goals";

const goalInput = z.object({
  title: z.string().trim().min(1).max(300),
  period: z.string().trim().max(40).nullable().optional(),
});

const updateGoalInput = z.object({
  goalId: z.string().min(1),
  title: z.string().trim().min(1).max(300).optional(),
  status: z.enum(["active", "done", "dropped"]).optional(),
});

const keyResultInput = z.object({
  goalId: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  kind: z.enum(["number", "percent", "linked"]),
  target: z.number().int().min(0).max(100_000_000),
});

const keyResultValueInput = z.object({
  keyResultId: z.string().min(1),
  current: z.number().int().min(0).max(100_000_000),
});

const linkInput = z.object({
  goalId: z.string().min(1),
  entityType: z.enum(["card", "habit"]),
  entityId: z.string().min(1),
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
    console.error("[goals] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function createGoalAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await createGoal(userId, goalInput.parse(input));
    return null;
  });
}

export async function updateGoalAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await updateGoal(userId, updateGoalInput.parse(input));
    return null;
  });
}

export async function createKeyResultAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await createKeyResult(userId, keyResultInput.parse(input));
    return null;
  });
}

export async function setKeyResultValueAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await setKeyResultValue(userId, keyResultValueInput.parse(input));
    return null;
  });
}

export async function linkToGoalAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await linkToGoal(userId, linkInput.parse(input));
    return null;
  });
}
