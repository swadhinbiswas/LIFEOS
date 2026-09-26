"use server";

import { ZodError } from "zod";

import { BoardError } from "@/server/boards";
import type { ActionResult } from "@/server/boards/actions";
import { getServerSession } from "@/server/auth/session";

import {
  addInterview,
  addOffer,
  createJob,
  getJobMeta,
  moveJobToStage,
  updateJob,
  type JobCardMeta,
} from "@/server/career";
import { addQuestion, addStory } from "@/server/career/prep";
import {
  clearSampleGrowth,
  createAchievement,
  createProject,
  createSkill,
  importSamplePortfolio,
  type ImportSummary,
} from "@/server/career/growth";
import {
  addInterviewInput,
  addOfferInput,
  addQuestionInput,
  addStoryInput,
  createAchievementInput,
  createJobInput,
  createProjectInput,
  createSkillInput,
  moveJobToStageInput,
  updateJobInput,
} from "@/server/career/schemas";

/**
 * Thin Server-Action adapters over the career service (spec §7.2), same shape as the board
 * actions: failures cross the boundary as a discriminated result because Next sanitizes thrown
 * messages in production.
 */

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof BoardError) return { ok: false, code: error.code, message: error.message };
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[career] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function createJobAction(
  input: unknown,
): Promise<ActionResult<{ cardId: string; applicationId: string }>> {
  return run(async (userId) => {
    const result = await createJob(userId, createJobInput.parse(input));
    return { cardId: result.card.id, applicationId: result.application.id };
  });
}

export async function updateJobAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await updateJob(userId, updateJobInput.parse(input));
    return null;
  });
}

/** The table's stage dropdown: name the stage, let the service resolve the column and the version. */
export async function moveJobToStageAction(
  input: unknown,
): Promise<ActionResult<{ cardId: string; stage: string }>> {
  return run(async (userId) => {
    const parsed = moveJobToStageInput.parse(input);
    return moveJobToStage(userId, parsed);
  });
}

export async function jobMetaAction(): Promise<ActionResult<Record<string, JobCardMeta[]>>> {
  return run((userId) => getJobMeta(userId));
}

export async function addInterviewAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await addInterview(userId, addInterviewInput.parse(input));
    return null;
  });
}

export async function addOfferAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await addOffer(userId, addOfferInput.parse(input));
    return null;
  });
}

export async function importSamplePortfolioAction(): Promise<ActionResult<ImportSummary>> {
  return run((userId) => importSamplePortfolio(userId));
}

export async function clearSampleGrowthAction(): Promise<ActionResult<{ removed: number }>> {
  return run(async (userId) => ({ removed: await clearSampleGrowth(userId) }));
}

export async function createSkillAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const parsed = createSkillInput.parse(input);
    await createSkill(userId, parsed);
    return null;
  });
}

export async function createProjectAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const parsed = createProjectInput.parse(input);
    await createProject(userId, {
      name: parsed.name,
      description: parsed.description ?? null,
      url: parsed.url ?? null,
      repo: parsed.url ?? null,
      tech: {
        language: parsed.language ?? null,
        stars: parsed.stars ?? 0,
        topics: [],
      },
      featured: parsed.featured ?? false,
    });
    return null;
  });
}

export async function createAchievementAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const parsed = createAchievementInput.parse(input);
    await createAchievement(userId, {
      title: parsed.title,
      description: parsed.description ?? null,
      impact: parsed.impact ?? null,
      occurredAt: parsed.occurredAt ?? null,
    });
    return null;
  });
}

export async function addQuestionAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const parsed = addQuestionInput.parse(input);
    await addQuestion(userId, parsed);
    return null;
  });
}

export async function addStoryAction(input: unknown): Promise<ActionResult<null>> {
  return run(async (userId) => {
    const parsed = addStoryInput.parse(input);
    await addStory(userId, parsed);
    return null;
  });
}
