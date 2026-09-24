"use server";

import { z } from "zod";

import { captureTask, parseCapture, type ParsedCapture } from "@/server/capture";
import { getServerSession } from "@/server/auth/session";
import type { ActionResult } from "@/server/boards/actions";

/**
 * Quick-capture adapter (spec §4.3/§6.2). `preview` never writes — it is the same pure parser
 * the create path uses, so the preview can never disagree with what gets saved.
 */

const captureInput = z.object({
  text: z.string().trim().min(1).max(500),
  columnName: z.string().trim().min(1).max(60).optional(),
});

export async function previewCaptureAction(input: unknown): Promise<ActionResult<ParsedCapture>> {
  const parsed = captureInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: "nothing to parse" };
  return { ok: true, data: parseCapture(parsed.data.text) };
}

export async function captureTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };

  const parsed = captureInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: "nothing to capture" };

  try {
    const result = await captureTask(session.user.id, parsed.data.text, {
      ...(parsed.data.columnName ? { columnName: parsed.data.columnName } : {}),
    });
    if (!result) return { ok: false, code: "invalid", message: "nothing to capture" };
    return { ok: true, data: { id: result.card.id } };
  } catch (error) {
    console.error("[capture] failed", error);
    return { ok: false, code: "invalid", message: "could not save that — please retry" };
  }
}
