import { z } from "zod";

/** Career contracts (spec §6.3). Shared by Server Actions, REST/MCP and the AI tools. */

const optionalText = (max = 2_000) => z.string().trim().max(max).nullable().optional();
const minorUnits = z.number().int().min(0).max(1_000_000_000).nullable().optional();

export const workModeSchema = z.enum(["remote", "hybrid", "onsite"]);
export const interviewKindSchema = z.enum([
  "screen",
  "tech",
  "system_design",
  "behavioral",
  "final",
  // A follow-up is a task with a due date, not a meeting — see the ADR-114 note on `due_at`.
  "follow_up",
]);
export const senioritySchema = z.enum(["junior", "mid", "senior", "not_stated"]);
export const relationshipSchema = z.enum(["cold", "contacted", "replied", "referral"]);
export const interviewStatusSchema = z.enum(["planned", "done", "needs_follow_up", "cancelled"]);

/** `YYYY-MM-DD` or a full instant; the app stores instants and renders days. */
const dateish = z.coerce.date().nullable().optional();

export const createJobInput = z.object({
  title: z.string().trim().min(1).max(300),
  /** Matched case-insensitively; a new company row is created when unknown. */
  companyName: optionalText(200),
  /** Stage column on the job board; defaults to the first column (Wishlist). */
  columnName: z.string().trim().min(1).max(120).optional(),
  url: optionalText(2_000),
  source: optionalText(120),
  workMode: workModeSchema.nullable().optional(),
  visaStatus: optionalText(120),
  salaryMin: minorUnits,
  salaryMax: minorUnits,
  currency: z.string().trim().length(3).nullable().optional(),
  /** The posting won't survive; capture it at entry time (ADR-044). */
  jdSnapshot: optionalText(50_000),
  excitement: z.number().int().min(1).max(5).nullable().optional(),
  fitScore: z.number().int().min(0).max(100).nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  // The next-action trio (ADR-114): the thing to do, and when it stops being optional.
  nextAction: optionalText(500),
  nextActionDue: dateish,
  applyBy: dateish,
  dateApplied: dateish,
  seniority: senioritySchema.nullable().optional(),
  applyEmail: z.string().trim().email().nullable().optional(),
  reqId: optionalText(80),
  location: optionalText(200),
});

export const ensureCompanyInput = z.object({
  name: z.string().trim().min(1).max(200),
  domain: optionalText(300),
  industry: optionalText(120),
  size: optionalText(60),
  location: optionalText(200),
  notes: optionalText(10_000),
  careerPage: optionalText(2_000),
  linkedin: optionalText(2_000),
  relationship: relationshipSchema.nullable().optional(),
  targetCountry: z.array(z.string().trim().min(1).max(80)).max(12).nullable().optional(),
});

export const updateJobInput = z.object({
  applicationId: z.string().min(1),
  companyName: optionalText(200),
  url: optionalText(2_000),
  source: optionalText(120),
  workMode: workModeSchema.nullable().optional(),
  visaStatus: optionalText(120),
  salaryMin: minorUnits,
  salaryMax: minorUnits,
  currency: z.string().trim().length(3).nullable().optional(),
  jdSnapshot: optionalText(50_000),
  coverLetter: optionalText(50_000),
  excitement: z.number().int().min(1).max(5).nullable().optional(),
  fitScore: z.number().int().min(0).max(100).nullable().optional(),
  archived: z.boolean().optional(),
  // Same trio as create, so a job can be corrected without recreating it.
  nextAction: optionalText(500),
  nextActionDue: dateish,
  applyBy: dateish,
  dateApplied: dateish,
  seniority: senioritySchema.nullable().optional(),
  applyEmail: z.string().trim().email().nullable().optional(),
  reqId: optionalText(80),
  location: optionalText(200),
  contactId: z.string().min(1).nullable().optional(),
  // The two fields the reference tracker has that are a *fact about this application*. `progress`
  // was here and is not any more: it is derived from the stage column (ADR-128), so accepting a
  // write would be the second source of truth for a number the column already determines.
  appId: optionalText(80),
  coverLetterNeeded: z.boolean().nullable().optional(),
});

/**
 * Move a job to a stage *by name*, appending to the end of that column.
 *
 * A separate input from `moveJobStageInput` because the two callers want different things. Dragging
 * a card is a placement: the client knows the neighbouring cards and the version it last saw. A
 * dropdown in a table row is a destination: "this one is in Interview now" says nothing about where
 * in the column it lands. Resolving the name, reading the current version and appending are three
 * things the caller would otherwise repeat in the UI, the MCP tool and the AI tool.
 */
export const moveJobToStageInput = z.object({
  applicationId: z.string().min(1),
  toStage: z.string().trim().min(1).max(80),
});

export const moveJobStageInput = z.object({
  applicationId: z.string().min(1),
  version: z.number().int().min(0),
  toColumnId: z.string().min(1),
  prevCardId: z.string().min(1).nullable(),
  nextCardId: z.string().min(1).nullable(),
});

export const addInterviewInput = z.object({
  applicationId: z.string().min(1),
  kind: interviewKindSchema,
  startsAt: z.coerce.date().nullable().optional(),
  durationMin: z.number().int().min(0).max(1_440).nullable().optional(),
  /** Interviewers as free text or JSON; stored as text, typed at the boundary. */
  interviewers: optionalText(2_000),
  feedback: optionalText(20_000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  // Follow-ups: a due date, an outcome, and notes read *before* the call (ADR-114).
  dueAt: dateish,
  status: interviewStatusSchema.nullable().optional(),
  outcome: optionalText(20_000),
  preparation: optionalText(20_000),
});

/** Raised when a follow-up or an application deadline has come round (ADR-114). */
export const updateInterviewInput = z.object({
  interviewId: z.string().min(1),
  status: interviewStatusSchema.nullable().optional(),
  outcome: optionalText(20_000),
  preparation: optionalText(20_000),
  feedback: optionalText(20_000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  dueAt: dateish,
  startsAt: dateish,
});

export const addOfferInput = z.object({
  applicationId: z.string().min(1),
  base: minorUnits,
  equity: minorUnits,
  bonus: minorUnits,
  currency: z.string().trim().length(3).nullable().optional(),
  receivedAt: z.coerce.date().nullable().optional(),
  notes: optionalText(20_000),
});

export type CreateJobInput = z.infer<typeof createJobInput>;
export type UpdateJobInput = z.infer<typeof updateJobInput>;
export type MoveJobStageInput = z.infer<typeof moveJobStageInput>;
export type MoveJobToStageInput = z.infer<typeof moveJobToStageInput>;
export type AddInterviewInput = z.infer<typeof addInterviewInput>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewInput>;
export type AddOfferInput = z.infer<typeof addOfferInput>;

/**
 * Fit as the four-way judgement a person actually makes, derived from `fitScore` rather than
 * stored beside it (ADR-114). Two fields for one opinion is two truths that will disagree.
 */
export const fitBandSchema = z.enum(["strong_fit", "worth_applying", "long_shot", "not_a_fit"]);

/** 0–100 score to band. The boundaries are the call, so they live in one place with a test. */
export function fitBandFor(
  score: number | null | undefined,
): "strong_fit" | "worth_applying" | "long_shot" | "not_a_fit" | null {
  if (score === null || score === undefined) return null;
  if (score >= 75) return "strong_fit";
  if (score >= 50) return "worth_applying";
  if (score >= 25) return "long_shot";
  return "not_a_fit";
}

export const createSkillInput = z.object({
  name: z.string().trim().min(1).max(120),
  level: z.number().int().min(1).max(5).nullable().optional(),
});

export const createProjectInput = z.object({
  name: z.string().trim().min(1).max(200),
  description: optionalText(2_000),
  url: optionalText(2_000),
  language: optionalText(80),
  stars: z.number().int().min(0).max(10_000_000).nullable().optional(),
  featured: z.boolean().optional(),
});

export const createAchievementInput = z.object({
  title: z.string().trim().min(1).max(300),
  description: optionalText(10_000),
  impact: optionalText(1_000),
  occurredAt: z.coerce.date().nullable().optional(),
});

export const addQuestionInput = z.object({
  question: z.string().trim().min(1).max(1_000),
  category: optionalText(120),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  answer: optionalText(20_000),
});

export const addStoryInput = z.object({
  title: z.string().trim().min(1).max(300),
  situation: optionalText(10_000),
  task: optionalText(10_000),
  action: optionalText(10_000),
  result: optionalText(10_000),
});
