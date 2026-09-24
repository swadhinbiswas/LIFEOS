"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import { createHabit, deleteHabit, setHabitLog } from "@/server/habits";

/** Habit adapters (spec §7.2): same discriminated-result shape as the board and career actions. */

const createInput = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["binary", "numeric"]).optional(),
  target: z.number().int().min(1).max(100_000).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  glyph: z.string().trim().max(8).nullable().optional(),
  freezeDays: z.number().int().min(0).max(30).optional(),
});

const logInput = z.object({
  habitId: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  value: z.number().int().min(0).max(100_000),
});

const idInput = z.object({ habitId: z.string().min(1) });

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[habits] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function createHabitAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await createHabit(userId, createInput.parse(input));
    return null;
  });
}

export async function logHabitAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await setHabitLog(userId, logInput.parse(input));
    return null;
  });
}

export async function deleteHabitAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deleteHabit(userId, idInput.parse(input).habitId);
    return null;
  });
}
