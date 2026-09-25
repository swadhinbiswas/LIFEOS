import { and, desc, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import {
  achievements,
  projects,
  resume_versions,
  resumes,
  skills,
  users,
} from "@/server/db/schema";

import { EMPTY_CV, parseCvDocument, type CvDocument } from "./schema";

/**
 * CV service (spec §6.3, ADR-017). One writer for `resumes` and `resume_versions`; the UI, the REST
 * API, the MCP server and the AI tools all call these functions.
 *
 * The "ATS score" is a **derived checklist**, never a promise: it reports what a résumé parser can
 * actually read (contact details, dated roles, quantified bullets) from the document's own fields.
 */

export interface ResumeSummary {
  id: string;
  title: string;
  template: string;
  atsScore: number | null;
  shareEnabled: boolean;
  shareSlug: string | null;
  updatedAt: Date;
}

export interface ResumeDetail {
  summary: ResumeSummary;
  document: CvDocument;
}

const toSummary = (row: typeof resumes.$inferSelect): ResumeSummary => ({
  id: row.id,
  title: row.title,
  template: row.template,
  atsScore: row.ats_score,
  shareEnabled: row.share_enabled,
  shareSlug: row.share_slug,
  updatedAt: row.updated_at,
});

export interface AtsCheck {
  key: string;
  ok: boolean;
}

/** Derived, explainable checks — the UI shows the list, not just a number (ADR-017). */
export function atsReview(document: CvDocument): { score: number; checks: AtsCheck[] } {
  const bullets = document.work.flatMap((entry) => entry.highlights);
  const checks: AtsCheck[] = [
    { key: "name", ok: document.basics.name.trim().length > 1 },
    { key: "email", ok: /@/.test(document.basics.email) },
    { key: "summary", ok: document.basics.summary.trim().length >= 40 },
    { key: "role", ok: document.work.some((entry) => entry.position.trim() !== "") },
    {
      key: "dated",
      ok: document.work.some(
        (entry) => entry.startDate !== undefined && entry.endDate !== undefined,
      ),
    },
    { key: "bullets", ok: bullets.length >= 3 },
    { key: "quantified", ok: bullets.some((line) => /\d/.test(line)) },
    { key: "skills", ok: document.skills.length >= 5 },
    { key: "projects", ok: document.projects.length >= 1 },
  ];
  const passed = checks.filter((check) => check.ok).length;
  return { score: Math.round((passed / checks.length) * 100), checks };
}

export async function listResumes(userId: string): Promise<ResumeSummary[]> {
  const rows = await db
    .select()
    .from(resumes)
    .where(eq(resumes.user_id, userId))
    .orderBy(desc(resumes.updated_at));
  return rows.map(toSummary);
}

export async function getResume(userId: string, id: string): Promise<ResumeDetail | null> {
  const [row] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.user_id, userId)))
    .limit(1);
  if (!row) return null;
  return { summary: toSummary(row), document: parseCvDocument(row.data) };
}

export async function createResume(
  userId: string,
  input: { title: string; template?: string; document?: CvDocument },
): Promise<{ id: string }> {
  const document = input.document ?? EMPTY_CV;
  const id = newId();
  await db.insert(resumes).values({
    id,
    user_id: userId,
    title: input.title.trim().slice(0, 200) || "Untitled CV",
    template: input.template ?? "classic",
    data: JSON.stringify(document),
    ats_score: atsReview(document).score,
  });
  return { id };
}

export async function updateResume(
  userId: string,
  input: { id: string; title?: string; template?: string; document?: CvDocument },
): Promise<void> {
  const patch: Partial<typeof resumes.$inferInsert> = { updated_at: new Date() };
  if (input.title !== undefined) patch.title = input.title.trim().slice(0, 200) || "Untitled CV";
  if (input.template !== undefined) patch.template = input.template;
  if (input.document !== undefined) {
    patch.data = JSON.stringify(input.document);
    patch.ats_score = atsReview(input.document).score;
  }
  await db
    .update(resumes)
    .set(patch)
    .where(and(eq(resumes.id, input.id), eq(resumes.user_id, userId)));
}

export async function deleteResume(userId: string, id: string): Promise<void> {
  await db.delete(resumes).where(and(eq(resumes.id, id), eq(resumes.user_id, userId)));
}

/** Snapshot the current document; an export is reproducible from one version row (ADR-044). */
export async function saveVersion(
  userId: string,
  resumeId: string,
  label?: string,
): Promise<{ id: string } | null> {
  const detail = await getResume(userId, resumeId);
  if (!detail) return null;
  const id = newId();
  await db.insert(resume_versions).values({
    id,
    user_id: userId,
    resume_id: resumeId,
    snapshot: JSON.stringify(detail.document),
    label: label ?? null,
    exported_at: new Date(),
  });
  return { id };
}

export async function listVersions(
  userId: string,
  resumeId: string,
): Promise<Array<{ id: string; label: string | null; createdAt: Date }>> {
  return db
    .select({
      id: resume_versions.id,
      label: resume_versions.label,
      createdAt: resume_versions.created_at,
    })
    .from(resume_versions)
    .where(and(eq(resume_versions.resume_id, resumeId), eq(resume_versions.user_id, userId)))
    .orderBy(desc(resume_versions.created_at));
}

export async function restoreVersion(userId: string, versionId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(resume_versions)
    .where(and(eq(resume_versions.id, versionId), eq(resume_versions.user_id, userId)))
    .limit(1);
  if (!row) return;
  await updateResume(userId, { id: row.resume_id, document: parseCvDocument(row.snapshot) });
}

/** Turn the public share link on or off, minting a slug the first time it is enabled. */
export async function setShare(
  userId: string,
  resumeId: string,
  enabled: boolean,
): Promise<string | null> {
  const detail = await getResume(userId, resumeId);
  if (!detail) return null;

  let slug = detail.summary.shareSlug;
  if (enabled && !slug) {
    slug = `${newId().slice(-8).toLowerCase()}`;
  }
  await db
    .update(resumes)
    .set({ share_enabled: enabled, share_slug: slug, updated_at: new Date() })
    .where(and(eq(resumes.id, resumeId), eq(resumes.user_id, userId)));
  return enabled ? slug : null;
}

/** A CV text section an agent may propose changes to (spec §9.2: proposals only, never a write). */
export const PROPOSABLE_SECTIONS = ["summary", "label"] as const;
export type ProposableSection = (typeof PROPOSABLE_SECTIONS)[number];

export interface ResumeEditProposal {
  resumeId: string;
  section: ProposableSection;
  /** The suggested replacement text. */
  content: string;
  /** What the field holds now, so a reviewer can see the diff. */
  current: string;
  /** Always false: this function never writes (spec §9.2). */
  applied: false;
}

/**
 * Build a resume edit **proposal**. It reads the CV to check ownership and to show the current
 * value, and it never writes — the user applies it in the editor, or approves it through the
 * copilot's normal approval flow. Returns null when the CV is not the caller's.
 */
export async function proposeResumeEdit(
  userId: string,
  input: { resumeId: string; section: ProposableSection; content: string },
): Promise<ResumeEditProposal | null> {
  const detail = await getResume(userId, input.resumeId);
  if (!detail) return null;

  const current =
    input.section === "summary" ? detail.document.basics.summary : detail.document.basics.label;
  return {
    resumeId: input.resumeId,
    section: input.section,
    content: input.content.slice(0, 4_000),
    current,
    applied: false,
  };
}

/** The public document behind a share link. Only ever returned when sharing is enabled. */ export async function getSharedResume(
  slug: string,
): Promise<{ title: string; document: CvDocument } | null> {
  const [row] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.share_slug, slug), eq(resumes.share_enabled, true)))
    .limit(1);
  if (!row) return null;
  return { title: row.title, document: parseCvDocument(row.data) };
}

/**
 * Start a CV from the data the user already entered (spec §6.3 "the demo is this feature run for the
 * sample profile"). Nothing is invented: name/email from the account, skills and projects from the
 * portfolio, summary left empty for the user to write.
 */
export async function seedResumeFromProfile(userId: string): Promise<{ id: string }> {
  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [skillRows, projectRows, achievementRows] = await Promise.all([
    db.select().from(skills).where(eq(skills.user_id, userId)),
    db.select().from(projects).where(eq(projects.user_id, userId)),
    db.select().from(achievements).where(eq(achievements.user_id, userId)),
  ]);

  const document: CvDocument = {
    ...EMPTY_CV,
    basics: { ...EMPTY_CV.basics, name: user?.name ?? "", email: user?.email ?? "" },
    skills: skillRows.map((skill) => ({
      name: skill.name,
      ...(skill.level ? { level: String(skill.level) } : {}),
      keywords: [],
    })),
    projects: projectRows.map((project) => ({
      name: project.name,
      description: project.description ?? "",
      ...(project.url ? { url: project.url } : {}),
      keywords: [],
    })),
    work: achievementRows.map((achievement) => ({
      name: "",
      position: achievement.title,
      summary: achievement.impact ?? "",
      highlights: [],
    })),
  };

  return createResume(userId, { title: `${user?.name ?? "My"} CV`, document });
}
