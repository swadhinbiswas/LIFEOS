"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { BOARD_TEMPLATES } from "@/config/board-templates";
import { DEFAULT_SEED_PROFILE, isSeedProfileId } from "@/config/seed-profiles";
import { auth } from "@/server/auth";
import { createBoard } from "@/server/boards";
import { seedUser } from "@/server/seed";

import { markOnboarded } from "./index";

/**
 * Finish onboarding (spec §14 Phase 8, ADR-085): optionally load the chosen sample profile, create
 * the chosen starter board, then mark the account onboarded. Idempotent enough to re-run safely —
 * the sample portfolio skips known rows and a second board is harmless.
 */

const input = z.object({
  profile: z.string().optional(),
  template: z.string().optional(),
  loadSample: z.boolean().optional(),
});

export async function completeOnboardingAction(
  raw: unknown,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "check the choices" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, message: "you are signed out" };

  const profile =
    parsed.data.profile && isSeedProfileId(parsed.data.profile)
      ? parsed.data.profile
      : DEFAULT_SEED_PROFILE;

  if (parsed.data.loadSample !== false && profile !== "blank") {
    await seedUser(session.user.id, profile);
  }

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
