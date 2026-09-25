import { z } from "zod";

/**
 * The CV document (spec §6.3, ADR-017): a **JSON Resume**-shaped subset, so the data is portable
 * and exportable without a bespoke format. Every field is defaulted, and unknown JSON Resume keys
 * are preserved on the stored document by the service, so importing someone else's file never loses
 * sections we do not model yet.
 */

const dateString = z.string().trim().max(20).optional();

export const cvProfileSchema = z.object({
  network: z.string().trim().max(60).default(""),
  username: z.string().trim().max(120).default(""),
  url: z.string().trim().max(500).optional(),
});

export const cvBasicsSchema = z.object({
  name: z.string().trim().max(120).default(""),
  label: z.string().trim().max(160).default(""),
  email: z.string().trim().max(200).default(""),
  url: z.string().trim().max(500).optional(),
  summary: z.string().trim().max(4_000).default(""),
  location: z
    .object({
      city: z.string().trim().max(120).optional(),
      region: z.string().trim().max(120).optional(),
      countryCode: z.string().trim().max(8).optional(),
    })
    .prefault({}),
  profiles: z.array(cvProfileSchema).max(10).default([]),
});

export const cvWorkSchema = z.object({
  name: z.string().trim().max(200).default(""),
  position: z.string().trim().max(200).default(""),
  location: z.string().trim().max(200).optional(),
  startDate: dateString,
  endDate: dateString,
  summary: z.string().trim().max(2_000).default(""),
  highlights: z.array(z.string().trim().max(500)).max(20).default([]),
});

export const cvEducationSchema = z.object({
  institution: z.string().trim().max(200).default(""),
  area: z.string().trim().max(200).optional(),
  studyType: z.string().trim().max(120).optional(),
  startDate: dateString,
  endDate: dateString,
});

export const cvSkillSchema = z.object({
  name: z.string().trim().max(120).default(""),
  level: z.string().trim().max(60).optional(),
  keywords: z.array(z.string().trim().max(80)).max(40).default([]),
});

export const cvProjectSchema = z.object({
  name: z.string().trim().max(200).default(""),
  description: z.string().trim().max(2_000).default(""),
  url: z.string().trim().max(500).optional(),
  keywords: z.array(z.string().trim().max(80)).max(30).default([]),
});

export const cvDocumentSchema = z
  .object({
    basics: cvBasicsSchema.prefault({}),
    work: z.array(cvWorkSchema).max(40).default([]),
    education: z.array(cvEducationSchema).max(20).default([]),
    skills: z.array(cvSkillSchema).max(60).default([]),
    projects: z.array(cvProjectSchema).max(40).default([]),
  })
  // Keep any JSON Resume sections we do not model (awards, languages, …) so an import round-trips.
  .passthrough();

export type CvDocument = z.infer<typeof cvDocumentSchema>;
export type CvWork = z.infer<typeof cvWorkSchema>;
export type CvEducation = z.infer<typeof cvEducationSchema>;

export const EMPTY_CV: CvDocument = cvDocumentSchema.parse({});

/** Parse stored JSON leniently: a hand-edited column degrades to the fields it can still read. */
export function parseCvDocument(raw: string | null | undefined): CvDocument {
  if (!raw) return EMPTY_CV;
  try {
    const parsed = cvDocumentSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_CV;
  } catch {
    return EMPTY_CV;
  }
}
