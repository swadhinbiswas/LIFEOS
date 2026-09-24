/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/career-detail-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/career-detail-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { addInterview, addOffer, createJob, getJobDetail, getJobMeta, updateJob } =
  await import("./index");

const USER = "01HCAREERDETAIL0000000000001";

describe("job detail surface (spec 6.3)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "career-detail@example.test",
      name: "Detail",
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("gives each job card its company/excitement chips and a detail link", async () => {
    const job = await createJob(USER, {
      title: "Site Reliability Engineer",
      companyName: "Hooli",
      source: "referral",
    });
    await updateJob(USER, { applicationId: job.application.id, excitement: 5 });

    const meta = await getJobMeta(USER);
    const chips = meta[job.card.id] ?? [];
    const labels = chips.map((chip) => chip.label);
    expect(labels).toContain("Hooli");
    expect(labels).toContain("★5");
    expect(labels).toContain("referral");
    expect(chips.at(-1)?.detailHref).toBe(`/career/jobs/${job.card.id}`);
  });

  it("resolves the detail by card id, including company and empty logs", async () => {
    const job = await createJob(USER, { title: "Platform Lead", companyName: "Initech" });
    const detail = await getJobDetail(USER, job.card.id);
    if (!detail) throw new Error("detail not found");
    expect(detail.card.title).toBe("Platform Lead");
    expect(detail.company?.name).toBe("Initech");
    expect(detail.interviews).toEqual([]);
    expect(detail.offers).toEqual([]);

    expect(await getJobDetail(USER, "01HNOPE00000000000000000000")).toBeNull();
  });

  it("records interview rounds and offers against the application", async () => {
    const job = await createJob(USER, { title: "Backend Engineer", companyName: "Globex" });

    await addInterview(USER, {
      applicationId: job.application.id,
      kind: "tech",
      startsAt: new Date("2026-10-02T13:00:00.000Z"),
      feedback: "pairing on rate limiting",
      rating: 4,
    });
    await addOffer(USER, {
      applicationId: job.application.id,
      base: 7_200_000,
      bonus: 500_000,
      currency: "EUR",
    });

    const detail = await getJobDetail(USER, job.card.id);
    if (!detail) throw new Error("detail not found");
    expect(detail.interviews).toHaveLength(1);
    expect(detail.interviews[0]?.kind).toBe("tech");
    expect(detail.interviews[0]?.rating).toBe(4);
    expect(detail.offers).toHaveLength(1);
    // Minor units, integer money (ADR-044).
    expect(detail.offers[0]?.base).toBe(7_200_000);
    expect(detail.offers[0]?.currency).toBe("EUR");
  });
});
