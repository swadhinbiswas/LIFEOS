"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import { createUser, deleteUser, isAdmin, listUsers, resetPassword, setRole } from "@/server/admin";

const createInput = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(200),
  role: z.enum(["admin", "user"]).optional(),
});

const targetInput = z.object({ userId: z.string().min(1) });

const resetInput = z.object({
  userId: z.string().min(1),
  password: z.string().min(8).max(200),
});

const roleInput = z.object({
  userId: z.string().min(1),
  role: z.enum(["admin", "user"]),
});

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  if (!(await isAdmin(session.user.id))) {
    return { ok: false, code: "unauthorized", message: "admin only" };
  }
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof ZodError)
      return { ok: false, code: "invalid", message: "that input is not valid" };
    console.error("[admin] action failed", error);
    return {
      ok: false,
      code: "invalid",
      message: error instanceof Error ? error.message : "something went wrong",
    };
  }
}

export async function listUsersAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof listUsers>>>
> {
  return run(() => listUsers());
}

export async function createUserAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async (userId) => {
    const p = createInput.parse(input);
    const id = await createUser(userId, {
      email: p.email,
      name: p.name,
      password: p.password,
      role: p.role,
    });
    return { id };
  });
}

export async function deleteUserAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deleteUser(userId, targetInput.parse(input).userId);
    return null;
  });
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const p = resetInput.parse(input);
    await resetPassword(userId, p.userId, p.password);
    return null;
  });
}

export async function setRoleAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const p = roleInput.parse(input);
    await setRole(userId, p.userId, p.role);
    return null;
  });
}
