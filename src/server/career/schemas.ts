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
]);

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
});

export const ensureCompanyInput = z.object({
  name: z.string().trim().min(1).max(200),
  domain: optionalText(300),
  industry: optionalText(120),
  size: optionalText(60),
  location: optionalText(200),
  notes: optionalText(10_000),
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
export type AddInterviewInput = z.infer<typeof addInterviewInput>;
export type AddOfferInput = z.infer<typeof addOfferInput>;

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
