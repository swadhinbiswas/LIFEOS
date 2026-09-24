"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import { HEALTH_KINDS, logHealth } from "@/server/health";

const input = z.object({
  kind: z.enum(HEALTH_KINDS),
  value: z.number().int().min(0).max(1_000_000),
  unit: z.string().trim().max(20).nullable().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  note: z.string().trim().max(10_000).nullable().optional(),
});

export async function logHealthAction(input_: unknown): Promise<ActionResult<null>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    await logHealth(session.user.id, input.parse(input_));
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[health] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}
