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

export type CreateJobInput = z.infer<typeof createJobInput>;
export type UpdateJobInput = z.infer<typeof updateJobInput>;
export type MoveJobStageInput = z.infer<typeof moveJobStageInput>;
