"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import { createPlan, deletePlan, updatePlan, linkToPlan, unlinkFromPlan } from "@/server/growth";

const planInput = z.object({
  dimensionId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  why: z.string().trim().max(500).nullable().optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

const updatePlanInput = z.object({
  planId: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  why: z.string().trim().max(500).nullable().optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  status: z.enum(["active", "achieved", "archived"]).optional(),
});

const linkInput = z.object({
  planId: z.string().min(1),
  entityType: z.enum(["goal", "habit"]),
  entityId: z.string().min(1),
});

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof ZodError)
      return { ok: false, code: "invalid", message: "that input is not valid" };
    console.error("[growth] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function createPlanAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async (userId) => {
    const p = planInput.parse(input);
    const id = await createPlan(userId, {
      dimensionId: p.dimensionId,
      title: p.title,
      why: p.why ?? null,
      targetDate: p.targetDate ?? null,
    });
    return { id };
  });
}

export async function updatePlanAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const p = updatePlanInput.parse(input);
    await updatePlan(userId, p.planId, {
      title: p.title,
      why: p.why,
      targetDate: p.targetDate,
      status: p.status,
    });
    return null;
  });
}

export async function deletePlanAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deletePlan(userId, z.object({ planId: z.string().min(1) }).parse(input).planId);
    return null;
  });
}

export async function linkToPlanAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const p = linkInput.parse(input);
    await linkToPlan(userId, p.planId, p.entityType, p.entityId);
    return null;
  });
}

export async function unlinkFromPlanAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const p = linkInput.parse(input);
    await unlinkFromPlan(userId, p.planId, p.entityType, p.entityId);
    return null;
  });
}
