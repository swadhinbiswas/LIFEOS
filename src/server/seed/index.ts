import { eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { DEFAULT_SEED_PROFILE, type SeedProfileId } from "@/config/seed-profiles";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { createBoard, createCard, ensureSystemTasksBoard, getBoard } from "@/server/boards";
import { createJob } from "@/server/career";
import { importSamplePortfolio } from "@/server/career/growth";
import { addQuestion, addStory } from "@/server/career/prep";
import { createGoal } from "@/server/goals";
import { createHabit, setHabitLog } from "@/server/habits";
import { createBook, createCourse } from "@/server/learning";
import { createNote } from "@/server/notes";

/**
 * Seeding (spec §12, ADR-084). Everything here is either derived from the committed research file
 * (`importSamplePortfolio`) or obviously sample content; fictional employers carry a `(sample)`
 * suffix. The profile decides which blocks run (ADR-085); `blank` only creates the tasks board.
 * `seedDemo` resets by deleting the demo user (cascade) and rebuilding, so the demo is reproducible.
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

const DEVELOPER_HABITS: Array<{
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

const STUDENT_HABITS = [
  { name: "Study block", kind: "numeric" as const, target: 2, unit: "hours" },
  { name: "Read 20 pages", kind: "numeric" as const, target: 20, unit: "pages" },
  { name: "Practice problems", kind: "numeric" as const, target: 3, unit: "problems" },
  { name: "In bed by 23:00", kind: "binary" as const },
];

const FREELANCER_HABITS = [
  { name: "Deep work", kind: "numeric" as const, target: 2, unit: "blocks" },
  { name: "Inbox to zero", kind: "binary" as const },
  { name: "Invoice day", kind: "binary" as const },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const recentDays = (count: number): string[] =>
  Array.from({ length: count }, (_, index) =>
    new Date(Date.now() - index * DAY_MS).toISOString().slice(0, 10),
  ).reverse();

export interface SeedSummary {
  profile: SeedProfileId;
  cards: number;
  jobs: number;
  habits: number;
  habitLogs: number;
  goals: number;
  notes: number;
  courses: number;
  books: number;
  projectsAdded: number;
  skillsAdded: number;
  questions: number;
  stories: number;
}

const emptySummary = (profile: SeedProfileId): SeedSummary => ({
  profile,
  cards: 0,
  jobs: 0,
  habits: 0,
  habitLogs: 0,
  goals: 0,
  notes: 0,
  courses: 0,
  books: 0,
  projectsAdded: 0,
  skillsAdded: 0,
  questions: 0,
  stories: 0,
});

async function addHabits(
  userId: string,
  summary: SeedSummary,
  habits: Array<{ name: string; kind: "binary" | "numeric"; target?: number; unit?: string }>,
): Promise<void> {
  const days = recentDays(30);
  for (const habit of habits) {
    const row = await createHabit(userId, {
      name: habit.name,
      kind: habit.kind,
      target: habit.target ?? null,
      unit: habit.unit ?? null,
    });
    summary.habits += 1;
    for (const date of days) {
      const digit = Number(date.slice(9));
      const value = habit.kind === "binary" ? (digit % 4 === 0 ? 0 : 1) : digit % 5;
      if (value > 0) {
        await setHabitLog(userId, { habitId: row.id, date, value });
        summary.habitLogs += 1;
      }
    }
  }
}

async function addTasks(userId: string, summary: SeedSummary, titles: string[]): Promise<void> {
  const board = await ensureSystemTasksBoard(userId);
  const payload = await getBoard(userId, board.id);
  const inbox = payload.columns.find((column) => column.name === "Inbox") ?? payload.columns[0];
  if (!inbox) return;
  for (const title of titles) {
    await createCard(userId, { boardId: board.id, columnId: inbox.id, title });
    summary.cards += 1;
  }
}

export async function seedUser(
  userId: string,
  profile: SeedProfileId = DEFAULT_SEED_PROFILE,
): Promise<SeedSummary> {
  const summary = emptySummary(profile);

  // Every profile gets a usable tasks board (blank included), so the dashboard is never empty.
  const starterTasks =
    profile === "blank"
      ? []
      : profile === "freelancer"
        ? ["Send the weekly client update", "Review the proposal", "Log billable time"]
        : [
            "Write the weekly update",
            "Review this week's priorities",
            "Follow up with the recruiter",
          ];
  await addTasks(userId, summary, starterTasks);

  if (profile === "blank") return summary;

  if (profile === "developer") {
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
    await addHabits(userId, summary, DEVELOPER_HABITS);

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
  }

  if (profile === "student") {
    await addHabits(userId, summary, STUDENT_HABITS);
    await createCourse(userId, { title: "Distributed systems", provider: "MIT OCW (sample)" });
    await createCourse(userId, {
      title: "Intro to statistics",
      provider: "Open textbook (sample)",
    });
    summary.courses += 2;
    await createBook(userId, {
      title: "Designing Data-Intensive Applications",
      author: "Martin Kleppmann",
    });
    await createBook(userId, { title: "How to Take Smart Notes", author: "Sönke Ahrens" });
    summary.books += 2;
    await createGoal(userId, { title: "Pass the algorithms exam", period: "2026-Q4" });
    summary.goals += 1;
    await createNote(userId, {
      title: "Study plan",
      body: "## This week\n- Two study blocks a day\n- One practice set\n\n_Sample content._",
    });
    summary.notes += 1;
  }

  if (profile === "freelancer") {
    await addHabits(userId, summary, FREELANCER_HABITS);
    await createBoard(userId, { name: "Clients", template: "daily-kanban" });
    await createGoal(userId, { title: "Three retainer clients", period: "2026-Q4" });
    summary.goals += 1;
    await createNote(userId, {
      title: "Client call notes",
      body: "## Call 2026-09-25\n- Scope\n- Timeline\n\n_Sample content._",
    });
    summary.notes += 1;
  }

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
    onboarded_at: new Date(),
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
  return seedUser(userId, "developer");
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
