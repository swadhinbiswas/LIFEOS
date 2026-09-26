"use server";

import { ZodError } from "zod";

import { BoardError } from "@/server/boards";
import type { ActionResult } from "@/server/boards/actions";
import { getServerSession } from "@/server/auth/session";
import { logDaySignal, readDaySignals, type DaySignals } from "@/server/day";

/**
 * Server Actions for the day strip (spec §7.2). Same discriminated-result shape as every other
 * action module, because Next sanitizes thrown messages in production and a sanitized "something
 * went wrong" tells the person nothing about which of two one-tap buttons they got wrong.
 */
async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof BoardError) return { ok: false, code: error.code, message: error.message };
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that value is not valid" };
    }
    console.error("[day] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

const input = {
  sleep: { min: 0, max: 24 },
  // 1–5 because that is the scale `health_logs.mood` already documents. Widening it here would
  // write values the health page's own form cannot produce.
  mood: { min: 1, max: 5 },
} as const;

export async function logDaySignalAction(
  input_: unknown,
): Promise<ActionResult<DaySignals | null>> {
  return run(async (userId) => {
    const parsed = input_ as { kind?: unknown; value?: unknown; day?: unknown };
    const kind = parsed.kind;
    if (kind !== "sleep" && kind !== "mood") {
      throw new BoardError("invalid", "kind must be sleep or mood");
    }
    const value = Number(parsed.value);
    const bounds = input[kind];
    if (!Number.isFinite(value) || value < bounds.min || value > bounds.max) {
      throw new BoardError("invalid", `value must be between ${bounds.min} and ${bounds.max}`);
    }
    return logDaySignal(userId, {
      kind,
      value,
      ...(typeof parsed.day === "string" ? { day: parsed.day } : {}),
    });
  });
}

export async function readDaySignalsAction(): Promise<ActionResult<DaySignals | null>> {
  return run((userId) => readDaySignals(userId));
}
