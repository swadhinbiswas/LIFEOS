"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { BOARD_TEMPLATES } from "@/config/board-templates";
import { auth } from "@/server/auth";
import { createBoard } from "@/server/boards";

import { markOnboarded } from "./index";

/**
 * Finish onboarding (spec §14 Phase 8, ADR-085): create the chosen starter board, then mark the
 * account onboarded. Idempotent enough to re-run safely — a second board is harmless.
 *
 * There is no sample-data option any more. It was the only other caller of the removed seed module
 * (ADR-123), and a new account now starts empty, which is the honest default: a personal OS that
 * invents a month of plausible history for someone who has just signed up is showing them data
 * that is not theirs.
 */

const input = z.object({
  template: z.string().optional(),
});

export async function completeOnboardingAction(
  raw: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "check the choices" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  if (parsed.data.template && parsed.data.template !== "none") {
    const template = BOARD_TEMPLATES.find((candidate) => candidate.id === parsed.data.template);
    await createBoard(session.user.id, {
      name: template?.name ?? "My board",
      template: parsed.data.template,
    });
  }

  await markOnboarded(session.user.id);
  return { ok: true };
}
