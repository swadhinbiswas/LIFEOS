/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/career-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/career-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { and, eq } = await import("drizzle-orm");
const { db } = await import("@/server/db");
const { job_applications, users } = await import("@/server/db/schema");
const { getBoard } = await import("@/server/boards");
const { createJob, ensureCompany, ensureJobBoard, getFunnel, moveJobStage, updateJob } =
  await import("./index");

const USER = "01HCAREER000000000000000001";
const FUNNEL_USER = "01HCAREER000000000000000002";

const stageId = async (userId: string, boardId: string, name: string): Promise<string> => {
  const payload = await getBoard(userId, boardId);
  const column = payload.columns.find((candidate) => candidate.name === name);
  if (!column) throw new Error(`no stage named ${name}`);
  return column.id;
};

describe("career service (spec 6.3, adr-044)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [USER, FUNNEL_USER].map((id) => ({
        id,
        email: `${id.toLowerCase()}@example.test`,
        name: id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  });

  it("creates a job as a board card plus an application with an opening stage entry", async () => {
    const result = await createJob(USER, {
      title: "Backend Engineer",
      companyName: "Acme",
      source: "LinkedIn",
      salaryMin: 6_000_000,
      salaryMax: 7_500_000,
      currency: "EUR",
      jdSnapshot: "posted 2026-09-20",
    });

    expect(result.card.kind).toBe("job");
    const board = await ensureJobBoard(USER);
    const payload = await getBoard(USER, board.id);
    const column = payload.columns.find((candidate) => candidate.id === result.card.column_id);
    expect(column?.name).toBe("Wishlist");

    const history = JSON.parse(result.application.stage_history) as Array<{ to: string }>;
    expect(history).toHaveLength(1);
    expect(history[0]?.to);
    expect(history[0]?.to).toBe("Wishlist");
    expect(result.application.company_id).not.toBeNull();
    expect(result.application.salary_min).toBe(6_000_000); // minor units, integer
  });

  it("reuses a company regardless of case", async () => {
    const first = await ensureCompany(USER, "Globex");
    const second = await ensureCompany(USER, "globex");
    expect(second).toBe(first);
  });

  it("appends stage history when the job moves, through the board service", async () => {
    const board = await ensureJobBoard(USER);
    const created = await createJob(USER, { title: "Data Engineer", companyName: "Initech" });
    const applied = await stageId(USER, board.id, "Applied");

    const moved = await moveJobStage(USER, {
      applicationId: created.application.id,
      version: created.card.version,
      toColumnId: applied,
      prevCardId: null,
      nextCardId: null,
    });
    expect(moved.column_id).toBe(applied);

    const [application] = await db
      .select()
      .from(job_applications)
      .where(
        and(eq(job_applications.id, created.application.id), eq(job_applications.user_id, USER)),
      );
    const history = JSON.parse(application?.stage_history ?? "[]") as Array<{
      from: string | null;
      to: string;
    }>;
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ from: "Wishlist", to: "Applied" });
  });

  it("updates side-table fields without touching the card", async () => {
    const created = await createJob(USER, { title: "Platform Engineer" });
    const updated = await updateJob(USER, {
      applicationId: created.application.id,
      source: "referral",
      excitement: 5,
      visaStatus: "sponsorship required",
    });
    expect(updated.source).toBe("referral");
    expect(updated.excitement).toBe(5);
    expect(updated.visa_status).toBe("sponsorship required");
  });

  it("derives the funnel and time-in-stage from stage history fixtures", async () => {
    const board = await ensureJobBoard(FUNNEL_USER);
    const applied = await stageId(FUNNEL_USER, board.id, "Applied");
    const screening = await stageId(FUNNEL_USER, board.id, "Screening");

    const jobA = await createJob(FUNNEL_USER, { title: "A", companyName: "Acme" });
    const jobB = await createJob(FUNNEL_USER, { title: "B", companyName: "Globex" });

    // A known fixture: A sat in Wishlist for 2 days then in Applied for 2 days and is now in
    // Screening; B is still in Wishlist since the fixture's start.
    await moveJobStage(FUNNEL_USER, {
      applicationId: jobA.application.id,
      version: jobA.card.version,
      toColumnId: applied,
      prevCardId: null,
      nextCardId: null,
    });
    const payload = await getBoard(FUNNEL_USER, board.id);
    const movedA = payload.cards.find((card) => card.id === jobA.card.id);
    if (!movedA) throw new Error("job A vanished");
    await moveJobStage(FUNNEL_USER, {
      applicationId: jobA.application.id,
      version: movedA.version,
      toColumnId: screening,
      prevCardId: null,
      nextCardId: null,
    });

    await db
      .update(job_applications)
      .set({
        stage_history: JSON.stringify([
          { from: null, to: "Wishlist", at: "2026-09-01T00:00:00.000Z" },
          { from: "Wishlist", to: "Applied", at: "2026-09-03T00:00:00.000Z" },
          { from: "Applied", to: "Screening", at: "2026-09-05T00:00:00.000Z" },
        ]),
      })
      .where(eq(job_applications.id, jobA.application.id));
    await db
      .update(job_applications)
      .set({
        stage_history: JSON.stringify([
          { from: null, to: "Wishlist", at: "2026-09-03T00:00:00.000Z" },
        ]),
      })
      .where(eq(job_applications.id, jobB.application.id));

    const funnel = await getFunnel(FUNNEL_USER, new Date("2026-09-06T00:00:00.000Z"));
    const byStage = new Map(funnel.stages.map((row) => [row.stage, row]));

    expect(byStage.get("Wishlist")?.count).toBe(1); // B is still there
    expect(byStage.get("Applied")?.count).toBe(0);
    expect(byStage.get("Screening")?.count).toBe(1); // A

    // Wishlist: A 2 days, B 3 days → mean 2.5. Applied: A 2 days.
    expect(byStage.get("Wishlist")?.averageDaysInStage).toBe(2.5);
    expect(byStage.get("Applied")?.averageDaysInStage).toBe(2);
    expect(funnel.total).toBe(2);
    expect(funnel.responseRate).toBe(0.5); // one of two ever left the first stage
  });
});
