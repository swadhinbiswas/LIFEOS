/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: own database; the name is per-process so two files cannot race the first DDL.
const DB_FILE = `.data/tracker-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { contacts, users } = await import("@/server/db/schema");
const { newId } = await import("@/lib/id");
const { addInterview, createJob, listFollowUps, updateInterview, updateJob } =
  await import("./index");
const { fitBandFor } = await import("./schemas");

const USER = "01HTRACK000000000000000001";
const OTHER = "01HTRACK000000000000000002";
const NOW = new Date("2026-09-26T12:00:00.000Z");

/**
 * The tracker fields the reference workspace made obvious (ADR-114). The two that matter most are
 * the ones a promise is made of: a next action, and a follow-up with a date.
 */
describe("the next-action model (ADR-114)", () => {
  let jobId: string;
  let cardId: string;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      [USER, OTHER].map((id) => ({
        id,
        email: `${id.toLowerCase()}@example.test`,
        name: id,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );

    const { card, application } = await createJob(USER, {
      title: "Senior Backend Engineer",
      companyName: "Northwind",
      nextAction: "email Sarah about the referral",
      nextActionDue: new Date("2026-09-28T09:00:00.000Z"),
      applyBy: new Date("2026-10-01T23:59:00.000Z"),
      seniority: "senior",
      applyEmail: "jobs@northwind.test",
      reqId: "REQ-4471",
      location: "Berlin, DE (remote)",
      salaryMin: 78_000,
      currency: "EUR",
    });
    jobId = application.id;
    cardId = card.id;
  });

  it("stores the fields the posting actually carries", async () => {
    const row = await updateJob(USER, { applicationId: jobId });
    expect(row).toMatchObject({
      next_action: "email Sarah about the referral",
      seniority: "senior",
      apply_email: "jobs@northwind.test",
      req_id: "REQ-4471",
      location: "Berlin, DE (remote)",
    });
    expect(row.apply_by?.toISOString()).toBe("2026-10-01T23:59:00.000Z");
    expect(row.next_action_due?.toISOString()).toBe("2026-09-28T09:00:00.000Z");
    // Money stays integer minor units with a currency (ADR-044) — the reference tracker's free-text
    // salary is the thing not to copy.
    expect(row.salary_min).toBe(78_000);
    expect(row.currency).toBe("EUR");
  });

  it("leaves omitted fields alone and clears only what is explicitly null", async () => {
    await updateJob(USER, { applicationId: jobId, nextAction: "ask for the referral deadline" });
    let row = await updateJob(USER, { applicationId: jobId });
    expect(row.next_action).toBe("ask for the referral deadline");
    // Not mentioned, so untouched — the apply-by deadline survived an unrelated edit.
    expect(row.apply_by).not.toBeNull();

    await updateJob(USER, { applicationId: jobId, applyBy: null });
    row = await updateJob(USER, { applicationId: jobId });
    expect(row.apply_by).toBeNull();
    expect(row.next_action).toBe("ask for the referral deadline");
  });

  it("refuses to attach another user's contact", async () => {
    const foreign = newId();
    await db.insert(contacts).values({
      id: foreign,
      user_id: OTHER,
      name: "Someone Else's Recruiter",
      created_at: new Date(),
      updated_at: new Date(),
    });

    // A stale or guessed id must fail loudly rather than silently cross-link (tenant rule).
    await expect(updateJob(USER, { applicationId: jobId, contactId: foreign })).rejects.toThrow(
      /contact not found/u,
    );

    const own = newId();
    await db.insert(contacts).values({
      id: own,
      user_id: USER,
      name: "Sarah",
      title: "Recruiter",
      created_at: new Date(),
      updated_at: new Date(),
    });
    const row = await updateJob(USER, { applicationId: jobId, contactId: own });
    expect(row.contact_id).toBe(own);
  });

  it("lists a follow-up as owed, and marks it overdue once the date passes", async () => {
    await addInterview(USER, {
      applicationId: jobId,
      kind: "follow_up",
      dueAt: new Date("2026-09-20T09:00:00.000Z"), // already past
    });

    const overdue = await listFollowUps(USER, NOW);
    const followUp = overdue.find((row) => row.kind === "follow_up");
    expect(followUp?.overdue).toBe(true);
    // The application's own words answer "what next", not the round's empty note.
    expect(followUp?.nextAction).toBe("ask for the referral deadline");
    expect(followUp?.company).toBe("Northwind");
    expect(followUp?.position).toBe("Senior Backend Engineer");
    expect(followUp?.cardId).toBe(cardId);
  });

  it("drops a ticked-off follow-up from the list, but can be asked for it back", async () => {
    const pending = (await listFollowUps(USER, NOW)).find((row) => row.interviewId !== null);
    expect(pending).toBeTruthy();
    if (!pending?.interviewId) throw new Error("expected a follow-up round");

    await updateInterview(USER, { interviewId: pending.interviewId, status: "done" });

    // The round is gone. The *application's* own next action is a separate promise and is still
    // outstanding — one list, two promises, each on its own line.
    const open = await listFollowUps(USER, NOW);
    expect(open.every((row) => row.interviewId !== pending.interviewId)).toBe(true);
    expect(open.some((row) => row.kind === "next_action")).toBe(true);

    const all = await listFollowUps(USER, NOW, true);
    expect(all).toHaveLength(2);
    // Done is not overdue, whatever the date says.
    expect(all.find((row) => row.interviewId === pending.interviewId)?.overdue).toBe(false);
  });

  it("keeps one user's follow-ups out of another's list", async () => {
    expect(await listFollowUps(OTHER, NOW, true)).toEqual([]);
  });

  it("keeps an interview with no due date off the owed list", async () => {
    await addInterview(USER, {
      applicationId: jobId,
      kind: "tech",
      startsAt: new Date("2026-09-02T14:00:00.000Z"),
      feedback: "went well",
    });
    // A past interview is not a promise, so it must not appear as one.
    const rows = await listFollowUps(USER, NOW, true);
    expect(rows.every((row) => row.kind !== "tech")).toBe(true);
  });
});

describe("fitBandFor (ADR-114)", () => {
  it("derives the four-way judgement from the score instead of storing it twice", () => {
    expect(fitBandFor(100)).toBe("strong_fit");
    expect(fitBandFor(75)).toBe("strong_fit");
    expect(fitBandFor(74)).toBe("worth_applying");
    expect(fitBandFor(50)).toBe("worth_applying");
    expect(fitBandFor(49)).toBe("long_shot");
    expect(fitBandFor(25)).toBe("long_shot");
    expect(fitBandFor(24)).toBe("not_a_fit");
    expect(fitBandFor(0)).toBe("not_a_fit");
  });

  it("says nothing when the user has not judged it", () => {
    // Null in, null out: a missing score is not a low score.
    expect(fitBandFor(null)).toBeNull();
    expect(fitBandFor(undefined)).toBeNull();
  });
});
