import { and, eq, gte, sql } from "drizzle-orm";

import { AI_LIMITS } from "@/config/ai";
import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { ai_usage } from "@/server/db/schema";

/**
 * Per-user AI usage (spec §8 "rate-limit and budget-cap per user", §8 "rough token cost"). One row
 * per completed run; `usageThisMonth` is what the settings page and the budget check read.
 * `cost_micros` stays 0 until a price can be sourced — we never invent a number (spec §1).
 */

export interface UsageInput {
  conversationId?: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros?: number;
}

export async function recordUsage(userId: string, input: UsageInput): Promise<void> {
  await db.insert(ai_usage).values({
    id: newId(),
    user_id: userId,
    conversation_id: input.conversationId ?? null,
    provider: input.provider,
    model: input.model,
    input_tokens: Math.max(0, Math.round(input.inputTokens)),
    output_tokens: Math.max(0, Math.round(input.outputTokens)),
    cost_micros: Math.max(0, Math.round(input.costMicros ?? 0)),
  });
}

export interface UsageSummary {
  runs: number;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
}

const startOfUtcMonth = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export async function usageThisMonth(
  userId: string,
  now: Date = new Date(),
): Promise<UsageSummary> {
  const [row] = await db
    .select({
      runs: sql<number>`count(*)`,
      inputTokens: sql<number>`coalesce(sum(${ai_usage.input_tokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${ai_usage.output_tokens}), 0)`,
      costMicros: sql<number>`coalesce(sum(${ai_usage.cost_micros}), 0)`,
    })
    .from(ai_usage)
    .where(and(eq(ai_usage.user_id, userId), gte(ai_usage.created_at, startOfUtcMonth(now))));

  return {
    runs: Number(row?.runs ?? 0),
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0),
    costMicros: Number(row?.costMicros ?? 0),
  };
}

/** Budget check run before every copilot turn. A 0 ceiling means "no ceiling yet". */
export async function withinBudget(
  userId: string,
  now: Date = new Date(),
): Promise<{ ok: boolean; summary: UsageSummary }> {
  const summary = await usageThisMonth(userId, now);
  const overRuns = AI_LIMITS.runsPerMonth > 0 && summary.runs >= AI_LIMITS.runsPerMonth;
  const overCost =
    AI_LIMITS.costMicrosPerMonth > 0 && summary.costMicros >= AI_LIMITS.costMicrosPerMonth;
  return { ok: !overRuns && !overCost, summary };
}
