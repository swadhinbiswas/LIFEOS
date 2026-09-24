"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import { addTransaction, createAccount, setBudget } from "@/server/finance";

const accountInput = z.object({
  name: z.string().trim().min(1).max(120),
  currency: z.string().trim().length(3),
  openingMinor: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
});

const transactionInput = z.object({
  accountId: z.string().min(1),
  amountMinor: z.number().int().min(-1_000_000_000).max(1_000_000_000),
  currency: z.string().trim().length(3).optional(),
  category: z.string().trim().max(80).nullable().optional(),
  merchant: z.string().trim().max(120).nullable().optional(),
});

const budgetInput = z.object({
  category: z.string().trim().min(1).max(80),
  limitMinor: z.number().int().min(1).max(1_000_000_000),
  currency: z.string().trim().length(3),
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
    console.error("[finance] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function createAccountAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await createAccount(userId, accountInput.parse(input));
    return null;
  });
}

export async function addTransactionAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await addTransaction(userId, transactionInput.parse(input));
    return null;
  });
}

export async function setBudgetAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await setBudget(userId, budgetInput.parse(input));
    return null;
  });
}
