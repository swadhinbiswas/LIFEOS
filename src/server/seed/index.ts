import { eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { createCard, ensureSystemTasksBoard, getBoard } from "@/server/boards";
import { createJob } from "@/server/career";
import { importSamplePortfolio } from "@/server/career/growth";
import { addQuestion, addStory } from "@/server/career/prep";
import { createGoal } from "@/server/goals";
import { createHabit, setHabitLog } from "@/server/habits";
import { createNote } from "@/server/notes";

/**
 * Seeding (spec §12, ADR-084). Everything here is either derived from the committed research file
 * (`importSamplePortfolio`) or obviously sample content; fictional employers carry a `(sample)`
 * suffix, and generated logs are labelled by the fact that they are generated. `seedDemo` resets by
 * deleting the demo user (cascade) and rebuilding, so the demo is always reproducible.
 */

export const DEMO_USER = {
  id: "01HDEMO00000000000000000001",
  email: "demo@lifeos.local",
  name: "Demo user",
};

/** Fictional employers, explicitly labelled — no real company is named as a sample application. */
const SAMPLE_JOBS: Array<{
  title: string;
  company: string;
  workMode: "remote" | "hybrid" | "onsite";
}> = [
  { title: "MLOps Engineer", company: "Acme Data GmbH (sample)", workMode: "hybrid" },
  { title: "Data Engineer", company: "Northwind Analytics AB (sample)", workMode: "remote" },
  { title: "Platform Engineer", company: "Riverstone Systems BV (sample)", workMode: "hybrid" },
  { title: "ML Infrastructure Engineer", company: "Lumen AI Oy (sample)", workMode: "remote" },
  { title: "Analytics Engineer", company: "Cobalt Retail AG (sample)", workMode: "onsite" },
  { title: "Backend Engineer (Data)", company: "Harbour Labs SA (sample)", workMode: "remote" },
  { title: "Data Platform Engineer", company: "Meridian Health NV (sample)", workMode: "hybrid" },
  { title: "Senior Data Engineer", company: "Signal Grid GmbH (sample)", workMode: "remote" },
];

const SAMPLE_HABITS: Array<{
  name: string;
  kind: "binary" | "numeric";
  target?: number;
  unit?: string;
}> = [
  { name: "LeetCode practice", kind: "numeric", target: 2, unit: "problems" },
  { name: "Read 20 pages", kind: "numeric", target: 20, unit: "pages" },
  { name: "Workout", kind: "binary" },
  { name: "Write", kind: "binary" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const recentDays = (count: number): string[] =>
  Array.from({ length: count }, (_, index) =>
    new Date(Date.now() - index * DAY_MS).toISOString().slice(0, 10),
  ).reverse();

export interface SeedSummary {
  cards: number;
  jobs: number;
  habits: number;
  habitLogs: number;
  goals: number;
  notes: number;
  projectsAdded: number;
  skillsAdded: number;
  questions: number;
  stories: number;
}

export async function seedUser(userId: string): Promise<SeedSummary> {
  const summary: SeedSummary = {
    cards: 0,
    jobs: 0,
    habits: 0,
    habitLogs: 0,
    goals: 0,
    notes: 0,
    projectsAdded: 0,
    skillsAdded: 0,
    questions: 0,
    stories: 0,
  };

  // A usable task board with a few cards, so the dashboard has something to count.
  const board = await ensureSystemTasksBoard(userId);
  const payload = await getBoard(userId, board.id);
  const inbox = payload.columns.find((column) => column.name === "Inbox") ?? payload.columns[0];
  if (inbox) {
    const titles = [
      "Write the weekly update",
      "Review the Q4 priorities",
      "Follow up with the recruiter",
      "Prep for the system-design round",
    ];
    for (const title of titles) {
      await createCard(userId, { boardId: board.id, columnId: inbox.id, title });
      summary.cards += 1;
    }
  }

  // Real repositories and languages from the committed research file (labelled `sample`).
  const growth = await importSamplePortfolio(userId);
  summary.projectsAdded = growth.projectsAdded;
  summary.skillsAdded = growth.skillsAdded;

  for (const job of SAMPLE_JOBS) {
    await createJob(userId, {
      title: job.title,
      companyName: job.company,
      workMode: job.workMode,
    });
    summary.jobs += 1;
  }

  const days = recentDays(30);
  for (const habit of SAMPLE_HABITS) {
    const row = await createHabit(userId, {
      name: habit.name,
      kind: habit.kind,
      target: habit.target ?? null,
      unit: habit.unit ?? null,
    });
    summary.habits += 1;
    // A generated history so the streak and chart views show real shapes (not a claim about anyone).
    for (const date of days) {
      const value =
        habit.kind === "binary" ? (date.charCodeAt(9) % 4 === 0 ? 0 : 1) : date.charCodeAt(9) % 5;
      if (value > 0) {
        await setHabitLog(userId, { habitId: row.id, date, value });
        summary.habitLogs += 1;
      }
    }
  }

  await createGoal(userId, { title: "Land an EU data or ML role", period: "2026-Q4" });
  summary.goals += 1;

  await createNote(userId, {
    title: "Weekly review template",
    body: [
      "## What moved",
      "- ",
      "",
      "## What got in the way",
      "- ",
      "",
      "## Next week",
      "- ",
      "",
      "_Sample content — edit or delete it._",
    ].join("\n"),
  });
  summary.notes += 1;

  await addQuestion(userId, {
    question: "Tell me about a hard data migration",
    category: "behavioural",
    difficulty: "medium",
  });
  summary.questions += 1;

  await addStory(userId, {
    title: "Cut pipeline latency",
    result: "Rewrote the batch job and halved the runtime (sample).",
  });
  summary.stories += 1;

  return summary;
}

export async function ensureDemoUser(): Promise<string> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_USER.email))
    .limit(1);
  if (existing) return existing.id;

  await db.insert(users).values({
    id: DEMO_USER.id,
    email: DEMO_USER.email,
    name: DEMO_USER.name,
    email_verified: true,
    is_demo: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return DEMO_USER.id;
}

/** Reset the demo by removing its account (cascade) and rebuilding it. */
export async function seedDemo(options: { reset?: boolean } = {}): Promise<SeedSummary> {
  if (options.reset) {
    await db.delete(users).where(eq(users.email, DEMO_USER.email));
  }
  const userId = await ensureDemoUser();
  return seedUser(userId);
}

/** The demo account id, if it exists — used by the public `/demo` preview. */
export async function demoUserId(): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_USER.email))
    .limit(1);
  return row?.id ?? null;
}

/** Reserve an id (kept here so the seed has one generator, like every other writer). */
export const seedId = newId;
