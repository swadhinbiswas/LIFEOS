import { and, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import {
  obligation_decisions,
  obligation_history,
  obligation_plans,
  transactions,
} from "@/server/db/schema";

// ---------------------------------------------------------------------------
// Occurrence generation (pure)
// ---------------------------------------------------------------------------

export interface Occurrence {
  id: string; // `${planId}:${index}`
  planId: string;
  index: number;
  dueDate: string; // YYYY-MM-DD
  amountMinor: number; // signed (negative debt, positive credit)
  status: "pending" | "paid" | "rejected";
  linkedTransactionId: string | null;
  paidAt: Date | null;
  rejectionNote: string | null;
}

export interface PlanRow {
  id: string;
  userId: string;
  direction: "debt" | "credit";
  name: string;
  person: string | null;
  notes: string | null;
  scheduleType: "one_time" | "recurring" | "split";
  amountMinor: number;
  currency: string;
  cadence: "daily" | "weekly" | "monthly" | "yearly" | null;
  intervalCount: number;
  totalPayments: number | null;
  endDate: string | null;
  startDate: string;
  status: "active" | "stopped";
  optionalSubscription: boolean;
}

function addPeriod(date: string, cadence: string, count: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  switch (cadence) {
    case "daily":
      dt.setUTCDate(dt.getUTCDate() + count);
      break;
    case "weekly":
      dt.setUTCDate(dt.getUTCDate() + count * 7);
      break;
    case "monthly": {
      const targetMonth = dt.getUTCMonth() + count;
      const year = dt.getUTCFullYear() + Math.floor(targetMonth / 12);
      const month = ((targetMonth % 12) + 12) % 12;
      const day = Math.min(d, daysInMonth(year, month + 1));
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    case "yearly": {
      const year = dt.getUTCFullYear() + count;
      const month = dt.getUTCMonth();
      const day = Math.min(d, daysInMonth(year, month + 1));
      // Feb 29 clamp
      if (month === 1 && d === 29 && !isLeap(year)) {
        return `${year}-02-28`;
      }
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(dt.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * Generate the due dates for a plan. Pure: same input → same output.
 * Returns an array of YYYY-MM-DD strings.
 */
export function generateDueDates(plan: PlanRow): string[] {
  const dates: string[] = [];
  if (plan.scheduleType === "one_time") {
    dates.push(plan.startDate);
    return dates;
  }

  const cadence = plan.cadence ?? "monthly";
  const interval = plan.intervalCount || 1;
  const total = plan.totalPayments ?? (plan.endDate ? 1000 : 1); // safety cap

  let current = plan.startDate;
  let count = 0;
  const maxOccurrences = Math.min(total, 500);
  while (count < maxOccurrences) {
    if (plan.endDate && current > plan.endDate) break;
    dates.push(current);
    count++;
    if (count >= maxOccurrences) break;
    const next = addPeriod(current, cadence, interval);
    if (next === current) break; // prevent infinite loop
    current = next;
  }
  return dates;
}

/**
 * Generate occurrences for a plan, merging with stored decisions.
 */
export function generateOccurrences(
  plan: PlanRow,
  decisions: Map<
    string,
    {
      status: string;
      linkedTransactionId: string | null;
      decidedAt: Date | null;
      rejectionNote: string | null;
    }
  >,
): Occurrence[] {
  const dates = generateDueDates(plan);
  const sign = plan.direction === "debt" ? -1 : 1;
  const isSplit = plan.scheduleType === "split";
  const splitAmount =
    isSplit && plan.totalPayments
      ? Math.floor(Math.abs(plan.amountMinor) / plan.totalPayments)
      : null;
  const remainder =
    isSplit && plan.totalPayments
      ? Math.abs(plan.amountMinor) - splitAmount! * (plan.totalPayments - 1)
      : null;

  return dates.map((date, index) => {
    const id = `${plan.id}:${index}`;
    const decision = decisions.get(id);
    let amount = plan.amountMinor;
    if (isSplit && splitAmount !== null && remainder !== null) {
      const isLast = index === dates.length - 1;
      amount = sign * (isLast ? remainder : splitAmount);
    }
    return {
      id,
      planId: plan.id,
      index,
      dueDate: date,
      amountMinor: amount,
      status: (decision?.status as "pending" | "paid" | "rejected") ?? "pending",
      linkedTransactionId: decision?.linkedTransactionId ?? null,
      paidAt: decision?.decidedAt ?? null,
      rejectionNote: decision?.rejectionNote ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function createPlan(
  userId: string,
  input: {
    direction: "debt" | "credit";
    name: string;
    person?: string | null;
    notes?: string | null;
    scheduleType: "one_time" | "recurring" | "split";
    amountMinor: number;
    currency: string;
    cadence?: string | null;
    intervalCount?: number;
    totalPayments?: number | null;
    endDate?: string | null;
    startDate: string;
    optionalSubscription?: boolean;
  },
): Promise<string> {
  const id = newId();
  await db.insert(obligation_plans).values({
    id,
    user_id: userId,
    direction: input.direction,
    name: input.name.trim(),
    person: input.person?.trim() || null,
    notes: input.notes?.trim() || null,
    schedule_type: input.scheduleType,
    amount_minor: input.amountMinor,
    currency: input.currency,
    cadence: input.cadence ?? null,
    interval_count: input.intervalCount ?? 1,
    total_payments: input.totalPayments ?? null,
    end_date: input.endDate ?? null,
    start_date: input.startDate,
    optional_subscription: input.optionalSubscription ?? false,
  });
  await db.insert(obligation_history).values({
    id: newId(),
    plan_id: id,
    user_id: userId,
    action: "created",
    details: JSON.stringify({ direction: input.direction, name: input.name }),
  });
  return id;
}

export async function listPlans(userId: string): Promise<PlanRow[]> {
  const rows = await db
    .select()
    .from(obligation_plans)
    .where(eq(obligation_plans.user_id, userId))
    .orderBy(obligation_plans.created_at);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    direction: r.direction as "debt" | "credit",
    name: r.name,
    person: r.person,
    notes: r.notes,
    scheduleType: r.schedule_type as "one_time" | "recurring" | "split",
    amountMinor: r.amount_minor,
    currency: r.currency,
    cadence: r.cadence as PlanRow["cadence"],
    intervalCount: r.interval_count,
    totalPayments: r.total_payments,
    endDate: r.end_date,
    startDate: r.start_date,
    status: r.status as "active" | "stopped",
    optionalSubscription: r.optional_subscription,
  }));
}

export async function getPlan(userId: string, planId: string): Promise<PlanRow | null> {
  const [row] = await db
    .select()
    .from(obligation_plans)
    .where(and(eq(obligation_plans.id, planId), eq(obligation_plans.user_id, userId)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    direction: row.direction as "debt" | "credit",
    name: row.name,
    person: row.person,
    notes: row.notes,
    scheduleType: row.schedule_type as "one_time" | "recurring" | "split",
    amountMinor: row.amount_minor,
    currency: row.currency,
    cadence: row.cadence as PlanRow["cadence"],
    intervalCount: row.interval_count,
    totalPayments: row.total_payments,
    endDate: row.end_date,
    startDate: row.start_date,
    status: row.status as "active" | "stopped",
    optionalSubscription: row.optional_subscription,
  };
}

export async function listOccurrences(userId: string, planId: string): Promise<Occurrence[]> {
  const plan = await getPlan(userId, planId);
  if (!plan) return [];
  const decisions = await db
    .select()
    .from(obligation_decisions)
    .where(eq(obligation_decisions.plan_id, planId));
  const decisionMap = new Map(
    decisions.map((d) => [
      d.occurrence_id,
      {
        status: d.status,
        linkedTransactionId: d.linked_transaction_id,
        decidedAt: d.decided_at,
        rejectionNote: d.rejection_note,
      },
    ]),
  );
  return generateOccurrences(plan, decisionMap);
}

export async function allOccurrences(
  userId: string,
  start: string,
  end: string,
): Promise<Occurrence[]> {
  const plans = await listPlans(userId);
  const activePlans = plans.filter((p) => p.status === "active");
  const result: Occurrence[] = [];
  for (const plan of activePlans) {
    const occs = await listOccurrences(userId, plan.id);
    for (const occ of occs) {
      if (occ.dueDate >= start && occ.dueDate <= end) {
        result.push(occ);
      }
    }
  }
  return result;
}

export async function payOccurrence(
  userId: string,
  occurrenceId: string,
  input: { accountId: string; occurredAt: Date; note?: string },
): Promise<void> {
  const planId = occurrenceId.split(":")[0] ?? "";
  const plan = await getPlan(userId, planId);
  if (!plan) throw new Error("plan not found");

  const occs = await listOccurrences(userId, planId);
  const occ = occs.find((o) => o.id === occurrenceId);
  if (!occ) throw new Error("occurrence not found");
  if (occ.status === "paid") throw new Error("already paid");

  // Create transaction
  const txId = newId();
  await db.insert(transactions).values({
    id: txId,
    user_id: userId,
    account_id: input.accountId,
    amount_minor: occ.amountMinor,
    currency: plan.currency,
    category: plan.direction === "debt" ? "obligation-payment" : "obligation-receipt",
    merchant: plan.person ?? plan.name,
    occurred_at: input.occurredAt,
    note: input.note ?? plan.name,
  });

  // Record decision
  await db
    .insert(obligation_decisions)
    .values({
      occurrence_id: occurrenceId,
      plan_id: planId,
      user_id: userId,
      status: "paid",
      linked_transaction_id: txId,
      decided_at: new Date(),
    })
    .onConflictDoUpdate({
      target: obligation_decisions.occurrence_id,
      set: {
        status: "paid",
        linked_transaction_id: txId,
        decided_at: new Date(),
        updated_at: new Date(),
      },
    });

  await db.insert(obligation_history).values({
    id: newId(),
    plan_id: planId,
    user_id: userId,
    occurrence_id: occurrenceId,
    action: "paid",
    details: JSON.stringify({ transactionId: txId, amount: occ.amountMinor }),
  });
}

export async function undoPayment(userId: string, occurrenceId: string): Promise<void> {
  const planId = occurrenceId.split(":")[0] ?? "";
  const plan = await getPlan(userId, planId);
  if (!plan) throw new Error("plan not found");

  const [decision] = await db
    .select()
    .from(obligation_decisions)
    .where(eq(obligation_decisions.occurrence_id, occurrenceId))
    .limit(1);
  if (!decision || decision.status !== "paid") throw new Error("not paid");

  // Delete the linked transaction if it still exists and is unchanged
  if (decision.linked_transaction_id) {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, decision.linked_transaction_id))
      .limit(1);
    if (tx) {
      await db.delete(transactions).where(eq(transactions.id, decision.linked_transaction_id));
    }
  }

  // Reset decision to pending
  await db
    .update(obligation_decisions)
    .set({
      status: "pending",
      linked_transaction_id: null,
      decided_at: null,
      updated_at: new Date(),
    })
    .where(eq(obligation_decisions.occurrence_id, occurrenceId));

  await db.insert(obligation_history).values({
    id: newId(),
    plan_id: planId,
    user_id: userId,
    occurrence_id: occurrenceId,
    action: "undo",
    details: JSON.stringify({}),
  });
}

export async function rejectOccurrence(
  userId: string,
  occurrenceId: string,
  note?: string,
): Promise<void> {
  const planId = occurrenceId.split(":")[0] ?? "";
  const plan = await getPlan(userId, planId);
  if (!plan) throw new Error("plan not found");

  await db
    .insert(obligation_decisions)
    .values({
      occurrence_id: occurrenceId,
      plan_id: planId,
      user_id: userId,
      status: "rejected",
      rejection_note: note ?? null,
      decided_at: new Date(),
    })
    .onConflictDoUpdate({
      target: obligation_decisions.occurrence_id,
      set: {
        status: "rejected",
        rejection_note: note ?? null,
        decided_at: new Date(),
        updated_at: new Date(),
      },
    });

  await db.insert(obligation_history).values({
    id: newId(),
    plan_id: planId,
    user_id: userId,
    occurrence_id: occurrenceId,
    action: "rejected",
    details: JSON.stringify({ note }),
  });
}

export async function restoreOccurrence(userId: string, occurrenceId: string): Promise<void> {
  const planId = occurrenceId.split(":")[0] ?? "";
  const plan = await getPlan(userId, planId);
  if (!plan) throw new Error("plan not found");

  await db
    .update(obligation_decisions)
    .set({ status: "pending", rejection_note: null, decided_at: null, updated_at: new Date() })
    .where(eq(obligation_decisions.occurrence_id, occurrenceId));

  await db.insert(obligation_history).values({
    id: newId(),
    plan_id: planId,
    user_id: userId,
    occurrence_id: occurrenceId,
    action: "restored",
    details: JSON.stringify({}),
  });
}

export async function stopPlan(userId: string, planId: string): Promise<void> {
  await db
    .update(obligation_plans)
    .set({ status: "stopped", updated_at: new Date() })
    .where(and(eq(obligation_plans.id, planId), eq(obligation_plans.user_id, userId)));
}

export async function deletePlan(userId: string, planId: string): Promise<void> {
  // Only allow delete if no paid occurrences
  const occs = await listOccurrences(userId, planId);
  const hasPaid = occs.some((o) => o.status === "paid");
  if (hasPaid) throw new Error("cannot delete a plan with paid occurrences — stop it instead");
  await db
    .delete(obligation_plans)
    .where(and(eq(obligation_plans.id, planId), eq(obligation_plans.user_id, userId)));
}

export async function updatePlanDetails(
  userId: string,
  planId: string,
  input: { name?: string; person?: string | null; notes?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.person !== undefined) patch.person = input.person?.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  await db
    .update(obligation_plans)
    .set(patch)
    .where(and(eq(obligation_plans.id, planId), eq(obligation_plans.user_id, userId)));
}
