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
const { board_columns, job_applications, users } = await import("@/server/db/schema");
const { listJobApplications } = await import("./applications");
const { getBoard } = await import("@/server/boards");
const { createJob, ensureCompany, ensureJobBoard, getFunnel, moveJobStage, updateJob } =
  await import("./index");

const USER = "01HCAREER000000000000000001";
const FUNNEL_USER = "01HCAREER000000000000000002";
const IMPORTED_USER = "01HCAREER000000000000000003";
const NEVER_SENT_USER = "01HCAREER000000000000000004";

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
      [USER, FUNNEL_USER, IMPORTED_USER, NEVER_SENT_USER].map((id) => ({
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

    // Stage-aware (ADR-105): B is still in Wishlist, so it was never sent and is not in the
    // denominator. A is the only application sent, and it reached Screening, so the rate is 1.
    expect(funnel.sent).toBe(1);
    expect(funnel.responded).toBe(1);
    expect(funnel.responseRate).toBe(1);
  });

  it("counts a response from the current stage alone, with no history at all", async () => {
    // The case the old definition got wrong: a pipeline seeded or imported straight into Screening
    // has a single history entry, so "ever changed stage" reads 0 responses on a pipeline that
    // plainly has one.
    const board = await ensureJobBoard(IMPORTED_USER);
    const screening = (await getBoard(IMPORTED_USER, board.id)).columns.find(
      (column) => column.name === "Screening",
    );
    if (!screening) throw new Error("pipeline stages missing");

    const job = await createJob(IMPORTED_USER, { title: "imported", source: "import" });
    const payload = await getBoard(IMPORTED_USER, board.id);
    const card = payload.cards.find((row) => row.id === job.card.id);
    if (!card) throw new Error("imported job missing");
    await moveJobStage(IMPORTED_USER, {
      applicationId: job.application.id,
      version: card.version,
      toColumnId: screening.id,
      prevCardId: null,
      nextCardId: null,
    });
    await db
      .update(job_applications)
      .set({
        stage_history: JSON.stringify([
          { from: null, to: "Screening", at: "2026-09-01T00:00:00.000Z" },
        ]),
      })
      .where(eq(job_applications.id, job.application.id));

    const funnel = await getFunnel(IMPORTED_USER, new Date("2026-09-06T00:00:00.000Z"));
    expect(funnel.sent).toBe(1);
    expect(funnel.responded).toBe(1);
    expect(funnel.responseRate).toBe(1);
  });

  it("is 0 when nothing has been sent, rather than dividing by the wishlist", async () => {
    const funnel = await getFunnel(NEVER_SENT_USER, new Date("2026-09-06T00:00:00.000Z"));
    expect(funnel.sent).toBe(0);
    expect(funnel.responseRate).toBe(0);
  });
});

/**
 * Stage semantics are data on the column, so an existing board has to acquire them (ADR-128).
 * This is the path every user with applications predating the migration depends on, and the e2e
 * probes cannot cover it: they sign up a fresh account, which always gets a brand-new board.
 */
describe("job board stage semantics (adr-128)", () => {
  const LEGACY_USER = "01HCAREER000000000000000005";
  let boardId = "";

  beforeAll(async () => {
    await db
      .insert(users)
      .values({
        id: LEGACY_USER,
        email: "legacy@example.test",
        name: "legacy",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflictDoNothing();

    // A board as it looked before the migration: correct columns, no weights, no colours.
    boardId = (await ensureJobBoard(LEGACY_USER)).id;
    await db
      .update(board_columns)
      .set({ progress_pct: null, color: null })
      .where(eq(board_columns.board_id, boardId));
    // A column the user added themselves, which no template knows about.
    await db.insert(board_columns).values({
      id: "col-legacy-custom",
      board_id: boardId,
      user_id: LEGACY_USER,
      name: "Ghosted by them",
      position: "zzzz",
      is_done: false,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("gives an existing board's columns a weight and a colour, keyed on the template's name", async () => {
    await ensureJobBoard(LEGACY_USER);
    const columns = await db
      .select({
        name: board_columns.name,
        pct: board_columns.progress_pct,
        color: board_columns.color,
      })
      .from(board_columns)
      .where(eq(board_columns.board_id, boardId));
    const byName = new Map(columns.map((c) => [c.name, c]));

    expect(byName.get("Applied")).toMatchObject({ pct: 15, color: "info" });
    expect(byName.get("Offer")).toMatchObject({ pct: 92, color: "success" });
    expect(byName.get("Rejected")).toMatchObject({ pct: null, color: "destructive" });
  });

  it("leaves a column the template does not know about alone", async () => {
    // Giving a hand-made column another stage's weight would be a fabrication. Null is the honest
    // answer, and it is also what stops the backfill fighting the user on every page load.
    const custom = await db
      .select({ pct: board_columns.progress_pct, color: board_columns.color })
      .from(board_columns)
      .where(eq(board_columns.id, "col-legacy-custom"));
    expect(custom[0]).toMatchObject({ pct: null, color: null });
  });

  it("does not overwrite a value the user has since chosen", async () => {
    await db
      .update(board_columns)
      .set({ progress_pct: 42, color: "warning" })
      .where(and(eq(board_columns.board_id, boardId), eq(board_columns.name, "Applied")));
    await ensureJobBoard(LEGACY_USER);
    const applied = await db
      .select({ pct: board_columns.progress_pct, color: board_columns.color })
      .from(board_columns)
      .where(and(eq(board_columns.board_id, boardId), eq(board_columns.name, "Applied")));
    expect(applied[0]).toMatchObject({ pct: 42, color: "warning" });
  });

  it("derives a row's progress from its column rather than storing one", async () => {
    await createJob(LEGACY_USER, { title: "Staff Engineer", companyName: "Legacy Co" });
    const rows = await listJobApplications(LEGACY_USER);
    const row = rows.find((r) => r.position === "Staff Engineer");
    // Wishlist, straight from the template. There is no `progress` column on the application at all.
    expect(row).toMatchObject({ progress: 5, stage: "Wishlist", stageColor: "muted-foreground" });
    // And there is no per-application copy to drift: the column was dropped in migration 0018, so
    // the storage layer cannot hold a second answer even if a caller tried.
    const [stored] = await db
      .select()
      .from(job_applications)
      .where(eq(job_applications.card_id, row!.cardId));
    expect(Object.keys(stored ?? {})).not.toContain("progress");
  });
});
