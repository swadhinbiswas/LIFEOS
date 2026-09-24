/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/career-growth-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/career-growth-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { SAMPLE_PORTFOLIO } = await import("@/config/sample-portfolio");
const {
  clearSampleGrowth,
  createProject,
  createSkill,
  importSamplePortfolio,
  listGrowth,
  parseProjectTech,
} = await import("./growth");

const USER = "01HCAREERGROWTH00000000000001";

describe("growth surfaces and the labelled sample import (spec 6.3, spec 12)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "career-growth@example.test",
      name: "Growth",
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("imports the research snapshot as labelled sample rows, exactly once", async () => {
    const first = await importSamplePortfolio(USER);
    expect(first.projectsAdded).toBe(SAMPLE_PORTFOLIO.projects.length);
    expect(first.skillsAdded).toBe(SAMPLE_PORTFOLIO.skills.length);
    expect(first.skipped).toBe(0);

    const second = await importSamplePortfolio(USER);
    expect(second.projectsAdded).toBe(0);
    expect(second.skillsAdded).toBe(0);
    expect(second.skipped).toBe(SAMPLE_PORTFOLIO.projects.length);

    const growth = await listGrowth(USER);
    expect(growth.projects).toHaveLength(SAMPLE_PORTFOLIO.projects.length);
    expect(growth.projects.every((project) => project.is_demo)).toBe(true);

    // Real facts, not placeholders: veet's own description, language and star count.
    const veet = growth.projects.find((project) => project.name === "veet");
    const tech = parseProjectTech(veet?.tech ?? null);
    expect(veet?.description).toContain("Uninstaller");
    expect(tech.language).toBe("Go");
    expect(tech.stars).toBe(151);
    // Featured is derived from the real star count, not hand-picked.
    expect(veet?.featured).toBe(true);
    expect(growth.projects.filter((project) => project.featured).length).toBe(4);
  });

  it("clears only the sample rows, leaving the user's own work", async () => {
    await createProject(USER, {
      name: "My own project",
      description: "written by the user",
      url: "https://example.test/mine",
    });

    const removed = await clearSampleGrowth(USER);
    expect(removed).toBe(SAMPLE_PORTFOLIO.projects.length);

    const growth = await listGrowth(USER);
    expect(growth.projects.map((project) => project.name)).toEqual(["My own project"]);
    expect(growth.projects[0]?.is_demo).toBe(false);
  });

  it("upserts skills by name instead of duplicating them", async () => {
    await createSkill(USER, { name: "Kubernetes" });
    await createSkill(USER, { name: "Kubernetes", level: 4 });

    const growth = await listGrowth(USER);
    const matches = growth.skills.filter((skill) => skill.name === "Kubernetes");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.level).toBe(4);
  });
});
