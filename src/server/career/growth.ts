import { and, desc, eq } from "drizzle-orm";

import { SAMPLE_PORTFOLIO } from "@/config/sample-portfolio";
import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { achievements, projects, skills } from "@/server/db/schema";

/**
 * Growth surfaces (spec §6.3): skills, achievements ("brag doc") and portfolio projects.
 *
 * Portfolio rows keep their repo facts in `tech` as JSON (`{language, stars, topics}`) — the
 * ERD calls that column the place for real repository facts, and this keeps the facts the
 * GitHub import actually has without inventing columns for presentation.
 *
 * The sample import is explicit and labelled: rows land with `is_demo = true`, so the UI can
 * mark them `sample` (spec §12) and a user's own entries are never mixed in silently.
 */

export type SkillRow = typeof skills.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type AchievementRow = typeof achievements.$inferSelect;

export interface ProjectTech {
  language: string | null;
  stars: number;
  topics: string[];
}

export function parseProjectTech(raw: string | null): ProjectTech {
  if (!raw) return { language: null, stars: 0, topics: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectTech>;
    return {
      language: parsed.language ?? null,
      stars: typeof parsed.stars === "number" ? parsed.stars : 0,
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    };
  } catch {
    return { language: null, stars: 0, topics: [] };
  }
}

export interface Growth {
  skills: SkillRow[];
  achievements: AchievementRow[];
  projects: ProjectRow[];
  /** Provenance for the sample import button. */
  sample: { source: string; fetchedAt: string; totalRepos: number };
}

export async function listGrowth(userId: string): Promise<Growth> {
  const [skillRows, achievementRows, projectRows] = await Promise.all([
    db
      .select()
      .from(skills)
      .where(eq(skills.user_id, userId))
      .orderBy(desc(skills.level), skills.name),
    db
      .select()
      .from(achievements)
      .where(eq(achievements.user_id, userId))
      .orderBy(desc(achievements.occurred_at)),
    db.select().from(projects).where(eq(projects.user_id, userId)).orderBy(projects.name),
  ]);

  return {
    skills: skillRows,
    achievements: achievementRows,
    projects: projectRows,
    sample: {
      source: SAMPLE_PORTFOLIO.source,
      fetchedAt: SAMPLE_PORTFOLIO.fetchedAt,
      totalRepos: SAMPLE_PORTFOLIO.totalRepos,
    },
  };
}

export async function createSkill(
  userId: string,
  input: { name: string; level?: number | null; evidence?: string | null },
): Promise<SkillRow> {
  const [row] = await db
    .insert(skills)
    .values({
      id: newId(),
      user_id: userId,
      name: input.name.trim(),
      level: input.level ?? null,
      evidence: input.evidence ?? null,
    })
    .onConflictDoUpdate({
      target: [skills.user_id, skills.name],
      set: { level: input.level ?? null, evidence: input.evidence ?? null },
    })
    .returning();
  if (!row) throw new Error("skill upsert returned no row");
  return row;
}

export async function createProject(
  userId: string,
  input: {
    name: string;
    description?: string | null;
    url?: string | null;
    repo?: string | null;
    tech?: ProjectTech | null;
    featured?: boolean;
  },
): Promise<ProjectRow> {
  const [row] = await db
    .insert(projects)
    .values({
      id: newId(),
      user_id: userId,
      name: input.name.trim(),
      description: input.description ?? null,
      url: input.url ?? null,
      repo: input.repo ?? null,
      tech: input.tech ? JSON.stringify(input.tech) : null,
      featured: input.featured ?? false,
    })
    .returning();
  if (!row) throw new Error("project insert returned no row");
  return row;
}

export async function createAchievement(
  userId: string,
  input: {
    title: string;
    description?: string | null;
    impact?: string | null;
    occurredAt?: Date | null;
  },
): Promise<AchievementRow> {
  const [row] = await db
    .insert(achievements)
    .values({
      id: newId(),
      user_id: userId,
      title: input.title.trim(),
      description: input.description ?? null,
      impact: input.impact ?? null,
      occurred_at: input.occurredAt ?? null,
    })
    .returning();
  if (!row) throw new Error("achievement insert returned no row");
  return row;
}

export interface ImportSummary {
  projectsAdded: number;
  skillsAdded: number;
  skipped: number;
}

/**
 * Import the Phase-0 seed research as a **labelled sample portfolio** (spec §12). Idempotent:
 * an existing project with the same repository URL, or a skill with the same name, is skipped
 * rather than duplicated. Nothing is imported automatically — the user asks for it.
 */
export async function importSamplePortfolio(userId: string): Promise<ImportSummary> {
  const existingProjects = await db
    .select({ url: projects.url })
    .from(projects)
    .where(eq(projects.user_id, userId));
  const knownUrls = new Set(existingProjects.map((row) => row.url));

  const existingSkills = await db
    .select({ name: skills.name })
    .from(skills)
    .where(eq(skills.user_id, userId));
  const knownSkills = new Set(existingSkills.map((row) => row.name.toLowerCase()));

  let projectsAdded = 0;
  let skipped = 0;

  for (const project of SAMPLE_PORTFOLIO.projects) {
    if (knownUrls.has(project.url)) {
      skipped += 1;
      continue;
    }
    await db.insert(projects).values({
      id: newId(),
      user_id: userId,
      name: project.name,
      description: project.description,
      url: project.url,
      repo: project.url,
      tech: JSON.stringify({
        language: project.language,
        stars: project.stars,
        topics: project.topics,
      } satisfies ProjectTech),
      featured: project.stars >= 40,
      is_demo: true,
    });
    projectsAdded += 1;
  }

  let skillsAdded = 0;
  for (const skill of SAMPLE_PORTFOLIO.skills) {
    if (knownSkills.has(skill.name.toLowerCase())) continue;
    await db
      .insert(skills)
      .values({
        id: newId(),
        user_id: userId,
        name: skill.name,
        // Level is not invented: it is the count of repositories using the language.
        level: null,
        evidence: JSON.stringify([
          {
            label: `${skill.repos} public repositories (sample)`,
            url: `${SAMPLE_PORTFOLIO.source} @ ${SAMPLE_PORTFOLIO.fetchedAt}`,
          },
        ]),
        is_demo: true,
      })
      .onConflictDoNothing();
    skillsAdded += 1;
  }

  return { projectsAdded, skillsAdded, skipped };
}

/** Sample rows can be removed again in one step, leaving the user's own entries untouched. */
export async function clearSampleGrowth(userId: string): Promise<number> {
  const removed = await db
    .delete(projects)
    .where(and(eq(projects.user_id, userId), eq(projects.is_demo, true)))
    .returning({ id: projects.id });
  await db.delete(skills).where(and(eq(skills.user_id, userId), eq(skills.is_demo, true)));
  return removed.length;
}
