/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

const DB_FILE = `.data/cv-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"])
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { projects, skills, users } = await import("@/server/db/schema");
const {
  atsReview,
  createResume,
  deleteResume,
  getResume,
  getSharedResume,
  listResumes,
  listVersions,
  restoreVersion,
  saveVersion,
  seedResumeFromProfile,
  setShare,
  updateResume,
} = await import("./index");
const { parseCvDocument } = await import("./schema");
const { toHtml, toJson, toMarkdown } = await import("./export");
const { toDocx } = await import("./docx");

const USER = "01HCV0000000000000000000001";
const OTHER = "01HCV0000000000000000000002";

const COMPLETE = {
  basics: {
    name: "Ada Lovelace",
    label: "Data Engineer",
    email: "ada@example.test",
    summary:
      "Data engineer focused on reliable batch and streaming pipelines across cloud platforms.",
  },
  work: [
    {
      name: "Acme Data (sample)",
      position: "Data Engineer",
      startDate: "2023-01",
      endDate: "2025-01",
      summary: "Owned the ingestion layer.",
      highlights: [
        "Cut pipeline runtime by 40%",
        "Led a warehouse migration",
        "Mentored two juniors",
      ],
    },
  ],
  education: [{ institution: "Sample University", area: "Computer Science", studyType: "BSc" }],
  skills: ["Python", "SQL", "Spark", "Airflow", "dbt"].map((name) => ({ name, keywords: [] })),
  projects: [{ name: "opengrammar", description: "Self-hosted grammar checker", keywords: [] }],
};

describe("cv service (spec §6.3, adr-017)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [USER, OTHER].map((id) => ({
        id,
        email: `${id.toLowerCase()}@example.test`,
        name: "Ada Lovelace",
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  });

  it("scores a document from its own fields, not a promise", () => {
    const weak = atsReview(parseCvDocument(null));
    expect(weak.score).toBe(0);
    const strong = atsReview(parseCvDocument(JSON.stringify(COMPLETE)));
    expect(strong.score).toBe(100);
    expect(strong.checks.every((check) => check.ok)).toBe(true);
  });

  it("creates, updates, lists and deletes a resume", async () => {
    const { id } = await createResume(USER, {
      title: "Data engineer CV",
      document: parseCvDocument(JSON.stringify(COMPLETE)),
    });
    await expect(listResumes(USER)).resolves.toHaveLength(1);

    await updateResume(USER, { id, title: "Renamed" });
    const detail = await getResume(USER, id);
    expect(detail?.summary.title).toBe("Renamed");
    expect(detail?.summary.atsScore).toBe(100);
    expect(detail?.document.basics.name).toBe("Ada Lovelace");

    await deleteResume(USER, id);
    await expect(listResumes(USER)).resolves.toHaveLength(0);
  });

  it("keeps resumes tenant-scoped", async () => {
    const { id } = await createResume(OTHER, { title: "Other CV" });
    expect(await getResume(USER, id)).toBeNull();
    await deleteResume(OTHER, id);
  });

  it("snapshots a version and restores it", async () => {
    const { id } = await createResume(USER, {
      title: "Versioned",
      document: parseCvDocument(JSON.stringify(COMPLETE)),
    });
    const version = await saveVersion(USER, id, "before edit");
    expect(version).not.toBeNull();

    await updateResume(USER, {
      id,
      document: parseCvDocument(JSON.stringify({ ...COMPLETE, basics: { name: "Someone else" } })),
    });
    expect((await getResume(USER, id))?.document.basics.name).toBe("Someone else");

    const versions = await listVersions(USER, id);
    expect(versions).toHaveLength(1);
    await restoreVersion(USER, version!.id);
    expect((await getResume(USER, id))?.document.basics.name).toBe("Ada Lovelace");
  });

  it("serves a shared resume only while sharing is enabled", async () => {
    const { id } = await createResume(USER, {
      title: "Shared",
      document: parseCvDocument(JSON.stringify(COMPLETE)),
    });
    const slug = await setShare(USER, id, true);
    expect(slug).toBeTruthy();
    expect((await getSharedResume(slug!))?.document.basics.name).toBe("Ada Lovelace");

    await setShare(USER, id, false);
    expect(await getSharedResume(slug!)).toBeNull();
  });

  it("builds a resume from the data the user already entered", async () => {
    await db
      .insert(skills)
      .values({ id: "01HCVSKILL0000000000000001", user_id: USER, name: "Rust" });
    await db.insert(projects).values({
      id: "01HCVPROJ00000000000000001",
      user_id: USER,
      name: "fetchx",
      description: "neofetch replacement",
    });
    const { id } = await seedResumeFromProfile(USER);
    const detail = await getResume(USER, id);
    expect(detail?.document.basics.name).toBe("Ada Lovelace");
    expect(detail?.document.skills.map((skill) => skill.name)).toContain("Rust");
    expect(detail?.document.projects.map((project) => project.name)).toContain("fetchx");
  });

  it("exports JSON, Markdown and print HTML with selectable text", () => {
    const document = parseCvDocument(JSON.stringify(COMPLETE));
    expect(JSON.parse(toJson(document)).basics.name).toBe("Ada Lovelace");
    const markdown = toMarkdown(document);
    expect(markdown).toContain("# Ada Lovelace");
    expect(markdown).toContain("- Cut pipeline runtime by 40%");
    const html = toHtml(document, "Data engineer CV");
    expect(html).toContain("<title>Data engineer CV</title>");
    expect(html).toContain("Cut pipeline runtime by 40%");
    expect(html).not.toContain("<img");
  });

  it("exports a DOCX that is a real Office archive", async () => {
    const document = parseCvDocument(JSON.stringify(COMPLETE));
    const buffer = await toDocx(document);
    // A .docx is a ZIP (PK\x03\x04) and carries more than an empty document.
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(buffer.length).toBeGreaterThan(1_000);
  });
});
