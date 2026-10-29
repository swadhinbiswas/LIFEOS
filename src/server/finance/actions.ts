"use server";

import { ZodError, z } from "zod";

import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";
import {
  addTransaction,
  createAccount,
  createSubscription,
  deleteSubscription,
  markSubscriptionRenewed,
  setBudget,
} from "@/server/finance";
import {
  createPlan,
  deletePlan,
  payOccurrence,
  rejectOccurrence,
  restoreOccurrence,
  stopPlan,
  undoPayment,
  updatePlanDetails,
} from "@/server/finance/obligations";

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

const subscriptionInput = z.object({
  name: z.string().trim().min(1).max(120),
  amountMinor: z.number().int().min(0).max(1_000_000_000),
  currency: z.string().trim().length(3),
  cadence: z.enum(["month", "year"]).optional(),
  renewsAt: z.coerce.date().nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
});

const subscriptionIdInput = z.object({ subscriptionId: z.string().min(1).max(64) });

const obligationIdInput = z.object({ planId: z.string().min(1) });
const occurrenceIdInput = z.object({ occurrenceId: z.string().min(1) });

const obligationPlanInput = z.object({
  direction: z.enum(["debt", "credit"]),
  name: z.string().trim().min(1).max(120),
  person: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  scheduleType: z.enum(["one_time", "recurring", "split"]),
  amountMinor: z.number().int().min(1).max(1_000_000_000),
  currency: z.string().trim().length(3),
  cadence: z.enum(["daily", "weekly", "monthly", "yearly"]).nullable().optional(),
  intervalCount: z.number().int().min(1).max(12).optional(),
  totalPayments: z.number().int().min(1).max(500).nullable().optional(),
  endDate: z
    .string()
    .regex(/^\\d{4}-\\d{2}-\\d{2}$/)
    .nullable()
    .optional(),
  startDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  optionalSubscription: z.boolean().optional(),
});

const payOccurrenceInput = z.object({
  occurrenceId: z.string().min(1),
  accountId: z.string().min(1),
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(300).optional(),
});

const rejectOccurrenceInput = z.object({
  occurrenceId: z.string().min(1),
  note: z.string().trim().max(300).optional(),
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

export async function createSubscriptionAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await createSubscription(userId, subscriptionInput.parse(input));
    return null;
  });
}

export async function deleteSubscriptionAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deleteSubscription(userId, subscriptionIdInput.parse(input).subscriptionId);
    return null;
  });
}

export async function markSubscriptionRenewedAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await markSubscriptionRenewed(userId, subscriptionIdInput.parse(input).subscriptionId);
    return null;
  });
}

export async function createObligationAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return run(async (userId) => {
    const p = obligationPlanInput.parse(input);
    const id = await createPlan(userId, {
      direction: p.direction,
      name: p.name,
      person: p.person ?? null,
      notes: p.notes ?? null,
      scheduleType: p.scheduleType,
      amountMinor: p.amountMinor,
      currency: p.currency,
      cadence: p.cadence ?? null,
      intervalCount: p.intervalCount,
      totalPayments: p.totalPayments ?? null,
      endDate: p.endDate ?? null,
      startDate: p.startDate,
      optionalSubscription: p.optionalSubscription,
    });
    return { id };
  });
}

export async function stopObligationAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await stopPlan(userId, obligationIdInput.parse(input).planId);
    return null;
  });
}

export async function deleteObligationAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deletePlan(userId, obligationIdInput.parse(input).planId);
    return null;
  });
}

export async function updateObligationAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const p = z
      .object({
        planId: z.string().min(1),
        name: z.string().trim().min(1).max(120).optional(),
        person: z.string().trim().max(120).nullable().optional(),
        notes: z.string().trim().max(500).nullable().optional(),
      })
      .parse(input);
    await updatePlanDetails(userId, p.planId, { name: p.name, person: p.person, notes: p.notes });
    return null;
  });
}

export async function payObligationAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const p = payOccurrenceInput.parse(input);
    await payOccurrence(userId, p.occurrenceId, {
      accountId: p.accountId,
      occurredAt: p.occurredAt,
      note: p.note,
    });
    return null;
  });
}

export async function undoObligationPaymentAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await undoPayment(userId, occurrenceIdInput.parse(input).occurrenceId);
    return null;
  });
}

export async function rejectObligationAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const p = rejectOccurrenceInput.parse(input);
    await rejectOccurrence(userId, p.occurrenceId, p.note);
    return null;
  });
}

export async function restoreObligationAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await restoreOccurrence(userId, occurrenceIdInput.parse(input).occurrenceId);
    return null;
  });
}
