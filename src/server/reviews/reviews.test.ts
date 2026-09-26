/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; assignment must precede any import
// that reaches src/env.ts.
process.env.DATABASE_URL = "file:.data/reviews-int.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`.data/reviews-int.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { users } = await import("@/server/db/schema");
const { getNote, searchNotes } = await import("@/server/notes");
const { completeReview, listReviews, renderReviewNote, renderSignalLines } =
  await import("./index");

const USER = "01HREVIEWS0000000000000000001";
const OTHER = "01HREVIEWS0000000000000000002";

describe("review wizard (spec 6.2/6.4)", () => {
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
  });

  it("renders the answers as a markdown note, steps included", () => {
    const body = renderReviewNote("weekly", "2026-09-24", {
      wins: "finished the dashboard",
      lessons: "started too late",
      next: "close the notes gap",
      clearedInbox: true,
      reviewedBoards: true,
      reviewedGoals: false,
    });
    expect(body).toContain("# Weekly review — 2026-09-24");
    expect(body).toContain("Steps: cleared the inbox, reviewed the boards, goals not reviewed.");
    expect(body).toContain("## Wins\nfinished the dashboard");
    expect(body).toContain("## Next\nclose the notes gap");
  });

  it("prints coverage beside every mean, so a number cannot imply a whole week", () => {
    // Three nights is a number about three nights. "7h" on its own claims a week.
    const { lines } = renderSignalLines(
      {
        sleep: 7,
        mood: null,
        habitPct: 50,
        focusMinutes: 90,
        coverage: { sleep: 3, mood: 0, habits: 7, focus: 2 },
        correlations: [],
        headline: null,
      },
      7,
    );
    expect(lines.join("\n")).toContain("Sleep: 7h (3 of 7 days)");
    expect(lines.join("\n")).toContain("Mood: not recorded");
    expect(lines.join("\n")).toContain("Habits kept: 50% (7 of 7 days)");
    expect(lines.join("\n")).toContain("Focus: 90 min over 2 days");
  });

  it("says a signal was not recorded rather than leaving the line out", () => {
    // "You did not log your mood" is the most actionable line in a review, and a silently absent
    // line is indistinguishable from a signal that does not exist.
    const { lines } = renderSignalLines(
      {
        sleep: null,
        mood: null,
        habitPct: 0,
        focusMinutes: 0,
        coverage: { sleep: 0, mood: 0, habits: 0, focus: 0 },
        correlations: [],
        headline: null,
      },
      7,
    );
    expect(lines).toHaveLength(4);
    expect(lines.join("\n")).toContain("Sleep: not recorded");
    expect(lines.join("\n")).toContain("Habits kept: none recorded");
  });

  it("appends the correlation only when there is one, and the note omits Signals otherwise", () => {
    const plain = renderReviewNote("weekly", "2026-09-24", {
      wins: "",
      lessons: "",
      next: "",
      clearedInbox: false,
      reviewedBoards: false,
      reviewedGoals: false,
    });
    // A caller with no signals gets the note it always got — no empty heading.
    expect(plain).not.toContain("## Signals");

    const withSignals = renderReviewNote(
      "weekly",
      "2026-09-24",
      {
        wins: "",
        lessons: "",
        next: "",
        clearedInbox: true,
        reviewedBoards: true,
        reviewedGoals: true,
      },
      { lines: ["- Sleep: 6.5h (7 of 7 days).", "", "More sleep went with more mood (6 days)."] },
    );
    expect(withSignals).toContain("## Signals\n- Sleep: 6.5h (7 of 7 days).");
    expect(withSignals).toContain("More sleep went with more mood (6 days).");
  });

  it("saves a review as a searchable note owned by the caller", async () => {
    const review = await completeReview(USER, {
      answers: {
        wins: "shipped the reviews wizard",
        lessons: "",
        next: "plan the next phase",
        clearedInbox: true,
        reviewedBoards: false,
        reviewedGoals: false,
      },
      day: "2026-09-24",
    });

    expect(review.note_id).not.toBeNull();
    const detail = await getNote(USER, review.note_id ?? "");
    expect(detail?.note.title).toBe("Weekly review — 2026-09-24");
    expect(detail?.note.body).toContain("shipped the reviews wizard");

    // It is an ordinary note: full-text search finds it, and the empty section is explicit.
    const hits = await searchNotes(USER, "wizard");
    expect(hits.map((hit) => hit.id)).toContain(review.note_id);
    expect(detail?.note.body).toContain("_nothing recorded_");

    expect((await listReviews(USER)).map((row) => row.id)).toContain(review.id);
    expect(await listReviews(OTHER)).toEqual([]);
  });
});
