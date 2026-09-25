/**
 * Seed profiles (spec §12, MVP #54, ADR-084/085). A profile decides **what sample data** a new
 * account starts with, so a student or a freelancer sees themselves in the product instead of a
 * developer's repos. Board templates are separate (`config/board-templates.ts`) and compose with
 * any profile.
 *
 * Names are data (like board-template names), not UI copy.
 */

export type SeedProfileId = "developer" | "student" | "freelancer" | "blank";

export interface SeedProfile {
  id: SeedProfileId;
  name: string;
  description: string;
  /** Whether this profile imports the research-derived portfolio (developer only). */
  usesResearchPortfolio: boolean;
}

export const SEED_PROFILES: SeedProfile[] = [
  {
    id: "developer",
    name: "Developer",
    description: "Repositories, skills, a job pipeline and interview prep.",
    usesResearchPortfolio: true,
  },
  {
    id: "student",
    name: "Student",
    description: "Study habits, courses and a reading list.",
    usesResearchPortfolio: false,
  },
  {
    id: "freelancer",
    name: "Freelancer",
    description: "Client work, a schedule and focus habits.",
    usesResearchPortfolio: false,
  },
  {
    id: "blank",
    name: "Blank",
    description: "Start with an empty tasks board and nothing else.",
    usesResearchPortfolio: false,
  },
];

export const DEFAULT_SEED_PROFILE: SeedProfileId = "developer";

const ids = new Set<string>(SEED_PROFILES.map((profile) => profile.id));

export function seedProfileById(id: string | null | undefined): SeedProfile {
  const found = id && ids.has(id) ? id : DEFAULT_SEED_PROFILE;
  return SEED_PROFILES.find((profile) => profile.id === found)!;
}

export function isSeedProfileId(id: string): id is SeedProfileId {
  return ids.has(id);
}
