import { eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { DEFAULT_SEED_PROFILE, type SeedProfileId } from "@/config/seed-profiles";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import {
  createBoard,
  createCard,
  ensureSystemTasksBoard,
  getBoard,
  moveCard,
} from "@/server/boards";
import { addInterview, addOffer, createJob } from "@/server/career";
import { importSamplePortfolio } from "@/server/career/growth";
import { addQuestion, addStory } from "@/server/career/prep";
import { getResume, seedResumeFromProfile, updateResume } from "@/server/cv";
import { addTransaction, createAccount, createSubscription, setBudget } from "@/server/finance";
import { createGoal, createKeyResult, setKeyResultValue } from "@/server/goals";
import { createHabit, setHabitLog } from "@/server/habits";
import { createBook, createCourse, setBookStatus, setCourseProgress } from "@/server/learning";
import { createNote } from "@/server/notes";

/**
 * Seeding (spec §12, ADR-084). Everything here is either derived from the committed research file
 * (`importSamplePortfolio`) or obviously sample content; fictional employers, courses, institutions
 * and amounts carry a `(sample)` marker. The profile decides which blocks run (ADR-085); `blank`
 * only creates the tasks board. `seedDemo` resets by deleting the demo user (cascade) and rebuilding,
 * so the demo is reproducible.
 *
 * The goal is a workspace that looks *used*: cards across every column with realistic detail, a job
 * pipeline spread over its stages with an interview and an offer, notes that link to each other, a
 * CV built from the profile, budgets and a month of transactions. None of it is presented as real.
 */

export const DEMO_USER = {
  id: "01HDEMO00000000000000000001",
  email: "demo@lifeos.local",
  name: "Demo user",
};

/** A seeded task. `complete` cards are created in the inbox and moved to `Done` so the service
 *  stamps `completed_at`, exactly as the UI does. */
interface SeedTask {
  title: string;
  column: string;
  description?: string;
  priority?: "p0" | "p1" | "p2" | "p3";
  estimateMin?: number;
  dueInDays?: number;
  complete?: boolean;
}

const DEVELOPER_TASKS: SeedTask[] = [
  {
    title: "Reply to the Northwind recruiter",
    column: "Inbox",
    priority: "p1",
    estimateMin: 10,
    description: "They asked for availability next week (sample).",
  },
  {
    title: "Finish the Spark optimisation write-up",
    column: "Today",
    priority: "p0",
    estimateMin: 45,
    dueInDays: 0,
    description: "Before/after runtime, the shuffle change and the cost note (sample).",
  },
  {
    title: "Review PR #482 on the ingestion service",
    column: "Today",
    priority: "p2",
    estimateMin: 20,
    dueInDays: 0,
  },
  {
    title: "Draft the Q4 goal review",
    column: "Upcoming",
    priority: "p2",
    estimateMin: 30,
    dueInDays: 3,
  },
  {
    title: "Tailor the CV for the platform roles",
    column: "Upcoming",
    priority: "p1",
    estimateMin: 40,
    dueInDays: 5,
    description: "Lead with the streaming migration, drop the coursework (sample).",
  },
  { title: "Read DDIA chapter 6", column: "Someday", priority: "p3", estimateMin: 60 },
  {
    title: "Prepare the Meridian interview loop",
    column: "Done",
    priority: "p1",
    estimateMin: 90,
    complete: true,
  },
  {
    title: "Ship the daily retention dbt model",
    column: "Done",
    priority: "p1",
    estimateMin: 120,
    complete: true,
  },
];

/** A seeded application. Interviews and offers run through the real services so the analytics and
 *  the calendar see them. */
const SAMPLE_JOBS: Array<{
  title: string;
  company: string;
  workMode: "remote" | "hybrid" | "onsite";
  stage: string;
  source?: string;
  url?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  excitement?: number;
  fitScore?: number;
  interview?: {
    kind: "screen" | "tech" | "system_design" | "behavioral" | "final";
    inDays: number;
    durationMin: number;
    interviewers: string;
  };
  offer?: {
    base: number;
    bonus: number;
    currency: string;
    inDays: number;
    notes: string;
  };
}> = [
  {
    title: "Senior Data Engineer",
    company: "Signal Grid GmbH (sample)",
    workMode: "remote",
    stage: "Offer",
    source: "Referral",
    salaryMin: 780_000,
    salaryMax: 920_000,
    currency: "EUR",
    excitement: 5,
    fitScore: 88,
    offer: {
      base: 860_000,
      bonus: 60_000,
      currency: "EUR",
      inDays: -2,
      notes: "Verbal offer; written pack promised this week (sample).",
    },
  },
  {
    title: "Data Platform Engineer",
    company: "Meridian Health NV (sample)",
    workMode: "hybrid",
    stage: "Technical",
    source: "Company site",
    salaryMin: 700_000,
    salaryMax: 840_000,
    currency: "EUR",
    excitement: 4,
    fitScore: 81,
    interview: {
      kind: "system_design",
      inDays: 2,
      durationMin: 90,
      interviewers: "Hiring manager + staff engineer (sample)",
    },
  },
  {
    title: "MLOps Engineer",
    company: "Acme Data GmbH (sample)",
    workMode: "hybrid",
    stage: "Screening",
    source: "LinkedIn",
    salaryMin: 680_000,
    salaryMax: 800_000,
    currency: "EUR",
    excitement: 4,
    fitScore: 76,
    interview: {
      kind: "screen",
      inDays: 1,
      durationMin: 30,
      interviewers: "Talent partner (sample)",
    },
  },
  {
    title: "Data Engineer",
    company: "Northwind Analytics AB (sample)",
    workMode: "remote",
    stage: "Applied",
    source: "Job board",
    salaryMin: 640_000,
    salaryMax: 760_000,
    currency: "EUR",
    excitement: 4,
    fitScore: 79,
  },
  {
    title: "Analytics Engineer",
    company: "Cobalt Retail AG (sample)",
    workMode: "onsite",
    stage: "Applied",
    source: "Job board",
    salaryMin: 620_000,
    salaryMax: 720_000,
    currency: "EUR",
    excitement: 3,
    fitScore: 68,
  },
  {
    title: "Platform Engineer",
    company: "Riverstone Systems BV (sample)",
    workMode: "hybrid",
    stage: "Rejected",
    source: "Recruiter",
    salaryMin: 660_000,
    salaryMax: 780_000,
    currency: "EUR",
    excitement: 3,
    fitScore: 64,
  },
  {
    title: "ML Infrastructure Engineer",
    company: "Lumen AI Oy (sample)",
    workMode: "remote",
    stage: "Wishlist",
    source: "Newsletter",
    salaryMin: 720_000,
    salaryMax: 880_000,
    currency: "EUR",
    excitement: 5,
    fitScore: 85,
  },
  {
    title: "Backend Engineer (Data)",
    company: "Harbour Labs SA (sample)",
    workMode: "remote",
    stage: "Wishlist",
    source: "Company site",
    salaryMin: 600_000,
    salaryMax: 740_000,
    currency: "EUR",
    excitement: 4,
    fitScore: 72,
  },
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

const dayFromNow = (days: number): Date => {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setHours(18, 0, 0, 0);
  return date;
};

export interface SeedSummary {
  profile: SeedProfileId;
  cards: number;
  jobs: number;
  interviews: number;
  offers: number;
  habits: number;
  habitLogs: number;
  goals: number;
  keyResults: number;
  notes: number;
  courses: number;
  books: number;
  accounts: number;
  transactions: number;
  budgets: number;
  subscriptions: number;
  resumes: number;
  projectsAdded: number;
  skillsAdded: number;
  questions: number;
  stories: number;
}

const emptySummary = (profile: SeedProfileId): SeedSummary => ({
  profile,
  cards: 0,
  jobs: 0,
  interviews: 0,
  offers: 0,
  habits: 0,
  habitLogs: 0,
  goals: 0,
  keyResults: 0,
  notes: 0,
  courses: 0,
  books: 0,
  accounts: 0,
  transactions: 0,
  budgets: 0,
  subscriptions: 0,
  resumes: 0,
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

/** Cards spread across the tasks board with real detail; `Done` cards are moved so the service
 *  timestamps them. */
async function addDeveloperTasks(userId: string, summary: SeedSummary): Promise<void> {
  const board = await ensureSystemTasksBoard(userId);
  const payload = await getBoard(userId, board.id);
  const byName = new Map(payload.columns.map((column) => [column.name, column.id]));
  const inbox = byName.get("Inbox") ?? payload.columns[0]?.id;
  const done = byName.get("Done");

  for (const task of DEVELOPER_TASKS) {
    const target = task.complete ? inbox : byName.get(task.column);
    const columnId = target ?? inbox;
    if (!columnId) continue;
    const card = await createCard(userId, {
      boardId: board.id,
      columnId,
      title: task.title,
      description: task.description,
      priority: task.priority ?? null,
      estimateMin: task.estimateMin ?? null,
      dueAt: task.dueInDays === undefined ? null : dayFromNow(task.dueInDays),
    });
    summary.cards += 1;
    if (task.complete && done) {
      await moveCard(userId, {
        cardId: card.id,
        version: card.version,
        toColumnId: done,
        prevCardId: null,
        nextCardId: null,
      });
    }
  }
}

async function addDeveloperJobs(userId: string, summary: SeedSummary): Promise<void> {
  for (const job of SAMPLE_JOBS) {
    const created = await createJob(userId, {
      title: job.title,
      companyName: job.company,
      columnName: job.stage,
      workMode: job.workMode,
      source: job.source ?? null,
      url: job.url ?? null,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      currency: job.currency ?? null,
      excitement: job.excitement ?? null,
      fitScore: job.fitScore ?? null,
    });
    summary.jobs += 1;

    if (job.interview) {
      await addInterview(userId, {
        applicationId: created.application.id,
        kind: job.interview.kind,
        startsAt: dayFromNow(job.interview.inDays),
        durationMin: job.interview.durationMin,
        interviewers: job.interview.interviewers,
      });
      summary.interviews += 1;
    }
    if (job.offer) {
      await addOffer(userId, {
        applicationId: created.application.id,
        base: job.offer.base,
        bonus: job.offer.bonus,
        currency: job.offer.currency,
        receivedAt: dayFromNow(job.offer.inDays),
        notes: job.offer.notes,
      });
      summary.offers += 1;
    }
  }
}

async function addDeveloperGoals(userId: string, summary: SeedSummary): Promise<void> {
  const role = await createGoal(userId, { title: "Land an EU data or ML role", period: "2026-Q4" });
  summary.goals += 1;
  const applications = await createKeyResult(userId, {
    goalId: role.id,
    title: "Applications sent",
    kind: "number",
    target: 40,
  });
  const interviews = await createKeyResult(userId, {
    goalId: role.id,
    title: "First-round interviews",
    kind: "number",
    target: 8,
  });
  await setKeyResultValue(userId, { keyResultId: applications.id, current: 18 });
  await setKeyResultValue(userId, { keyResultId: interviews.id, current: 3 });
  summary.keyResults += 2;

  const craft = await createGoal(userId, { title: "Publish the portfolio", period: "2026-Q4" });
  summary.goals += 1;
  const published = await createKeyResult(userId, {
    goalId: craft.id,
    title: "Projects published",
    kind: "number",
    target: 6,
  });
  await setKeyResultValue(userId, { keyResultId: published.id, current: 5 });
  summary.keyResults += 1;
}

async function addDeveloperNotes(userId: string, summary: SeedSummary): Promise<void> {
  const notes: Array<{ title: string; body: string }> = [
    {
      title: "Portfolio plan",
      body: [
        "## Goal",
        "Six projects published, each with a README that explains the trade-offs (sample).",
        "",
        "## Next up",
        "- Turn the [[Spark optimisation write-up]] into a post",
        "- Add tests to the streaming demo",
        "",
        "See the [[Weekly review — W38]] for what moved this week.",
        "",
        "_Sample content — edit or delete it._",
      ].join("\n"),
    },
    {
      title: "Interview notes — Meridian (sample)",
      body: [
        "## Loop",
        "Technical: system design on a health-data pipeline.",
        "",
        "## Prep",
        "- Re-read the streaming migration story",
        "- Two questions on on-call and data contracts",
        "",
        "_Sample content._",
      ].join("\n"),
    },
    {
      title: "Reading notes — DDIA ch. 5",
      body: [
        "## Replication",
        "- Single-leader is the default; understand the failover edge cases.",
        "- Replication lag is a product decision, not only an ops one.",
        "",
        "Back to [[Portfolio plan]].",
        "",
        "_Sample content._",
      ].join("\n"),
    },
  ];

  for (const note of notes) {
    await createNote(userId, note);
    summary.notes += 1;
  }

  const today = new Date().toISOString().slice(0, 10);
  await createNote(userId, {
    title: `Daily — ${today}`,
    kind: "daily",
    dailyDate: today,
    body: [
      "## Today",
      "- Spark write-up (in progress)",
      "- Recruiter reply",
      "",
      "## Mood",
      "Steady. The offer gives the search a floor (sample).",
    ].join("\n"),
  });
  summary.notes += 1;
}

/** A CV built from the profile, then given sample roles and education so the editor demo is real. */
async function addDeveloperCv(userId: string, summary: SeedSummary): Promise<void> {
  const { id } = await seedResumeFromProfile(userId);
  const detail = await getResume(userId, id);
  if (!detail) return;

  const document = detail.document;
  await updateResume(userId, {
    id,
    title: "Data engineer CV (sample)",
    document: {
      ...document,
      basics: {
        ...document.basics,
        label: "Data engineer — batch and streaming pipelines (sample)",
        summary:
          "Data engineer who has moved batch jobs to streaming and cut runtime and cost doing it. Comfortable across Python, SQL, Spark and dbt, and happiest when a pipeline is boring (sample).",
        location: { city: "Berlin", countryCode: "DE" },
        profiles: [{ network: "GitHub", username: "sample-dev", url: "https://github.com" }],
      },
      work: [
        {
          name: "Northwind Analytics AB (sample)",
          position: "Data Engineer",
          location: "Remote",
          startDate: "2023-03",
          endDate: "2026-08",
          summary: "Owned the ingestion and warehouse layer for a retail analytics product.",
          highlights: [
            "Cut the nightly pipeline runtime by 40% by reshaping shuffles and partition sizes.",
            "Introduced dbt tests on 120 models, catching contract breaks before they reached dashboards.",
            "Led a migration from cron plus cron-triggered scripts to Airflow with retries and alerts.",
          ],
        },
        {
          name: "Lumen AI Oy (sample)",
          position: "Junior Data Engineer",
          location: "Helsinki",
          startDate: "2021-06",
          endDate: "2023-02",
          summary: "Built the first warehouse and the reporting the product team relied on.",
          highlights: [
            "Designed the star schema that powered weekly retention reporting.",
            "Automated a manual CSV hand-off, saving a day of analyst time each week.",
          ],
        },
      ],
      education: [
        {
          institution: "State University (sample)",
          area: "Computer Science",
          studyType: "MSc",
          startDate: "2019-09",
          endDate: "2021-06",
        },
      ],
    },
  });
  summary.resumes += 1;
}

async function addDeveloperLearning(userId: string, summary: SeedSummary): Promise<void> {
  const zoomcamp = await createCourse(userId, {
    title: "Data Engineering Zoomcamp (sample)",
    provider: "DataTalksClub (sample)",
  });
  await setCourseProgress(userId, { courseId: zoomcamp.id, progress: 65 });
  const spark = await createCourse(userId, {
    title: "Advanced Spark (sample)",
    provider: "Online course (sample)",
  });
  await setCourseProgress(userId, { courseId: spark.id, progress: 30 });
  summary.courses += 2;

  const ddia = await createBook(userId, {
    title: "Designing Data-Intensive Applications",
    author: "Martin Kleppmann",
    status: "reading",
  });
  await setBookStatus(userId, { bookId: ddia.id, status: "reading" });
  const fode = await createBook(userId, {
    title: "Fundamentals of Data Engineering",
    author: "Reis & Housley",
  });
  await setBookStatus(userId, { bookId: fode.id, status: "finished" });
  summary.books += 2;
}

/** Two accounts, a month of transactions across real categories, budgets and subscriptions. */
async function addDeveloperFinance(userId: string, summary: SeedSummary): Promise<void> {
  const everyday = await createAccount(userId, {
    name: "Everyday (sample)",
    kind: "bank",
    currency: "EUR",
  });
  const savings = await createAccount(userId, {
    name: "Savings (sample)",
    kind: "bank",
    currency: "EUR",
  });
  summary.accounts += 2;

  const spend: Array<{
    daysAgo: number;
    amount: number;
    category: string;
    merchant: string;
    account: string;
    note?: string;
  }> = [
    {
      daysAgo: 32,
      amount: -950_00,
      category: "Rent",
      merchant: "Landlord (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 31,
      amount: -49_00,
      category: "Transport",
      merchant: "Transit pass (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 29,
      amount: -62_40,
      category: "Groceries",
      merchant: "Market (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 27,
      amount: -11_99,
      category: "Subscriptions",
      merchant: "Streaming (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 25,
      amount: 320_000,
      category: "Salary",
      merchant: "Employer (sample)",
      account: everyday.id,
      note: "Monthly salary (sample)",
    },
    {
      daysAgo: 24,
      amount: -1_400,
      category: "Coffee",
      merchant: "Cafe (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 21,
      amount: -38_70,
      category: "Groceries",
      merchant: "Market (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 18,
      amount: -12_99,
      category: "Subscriptions",
      merchant: "Music (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 15,
      amount: -54_00,
      category: "Dining",
      merchant: "Restaurant (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 13,
      amount: -27_30,
      category: "Groceries",
      merchant: "Market (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 11,
      amount: -19_90,
      category: "Transport",
      merchant: "Rail (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 9,
      amount: -8_00,
      category: "Subscriptions",
      merchant: "Notes app (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 7,
      amount: -44_10,
      category: "Groceries",
      merchant: "Market (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 5,
      amount: -6_50,
      category: "Coffee",
      merchant: "Cafe (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 3,
      amount: -31_80,
      category: "Groceries",
      merchant: "Market (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 2,
      amount: -15_00,
      category: "Dining",
      merchant: "Takeaway (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 1,
      amount: -2_99,
      category: "Subscriptions",
      merchant: "Cloud storage (sample)",
      account: everyday.id,
    },
    {
      daysAgo: 4,
      amount: 25_000,
      category: "Transfer",
      merchant: "Savings (sample)",
      account: savings.id,
      note: "Monthly transfer (sample)",
    },
  ];

  for (const entry of spend) {
    await addTransaction(userId, {
      accountId: entry.account,
      amountMinor: entry.amount,
      currency: "EUR",
      category: entry.category,
      merchant: entry.merchant,
      occurredAt: new Date(Date.now() - entry.daysAgo * DAY_MS),
      note: entry.note ?? null,
    });
    summary.transactions += 1;
  }

  await setBudget(userId, {
    category: "Groceries",
    period: "month",
    limitMinor: 350_00,
    currency: "EUR",
  });
  await setBudget(userId, {
    category: "Dining",
    period: "month",
    limitMinor: 120_00,
    currency: "EUR",
  });
  await setBudget(userId, {
    category: "Transport",
    period: "month",
    limitMinor: 80_00,
    currency: "EUR",
  });
  summary.budgets += 3;

  await createSubscription(userId, {
    name: "Streaming (sample)",
    amountMinor: 11_99,
    currency: "EUR",
    cadence: "month",
    renewsAt: dayFromNow(6),
  });
  await createSubscription(userId, {
    name: "Music (sample)",
    amountMinor: 12_99,
    currency: "EUR",
    cadence: "month",
    renewsAt: dayFromNow(12),
  });
  await createSubscription(userId, {
    name: "Cloud storage (sample)",
    amountMinor: 2_99,
    currency: "EUR",
    cadence: "month",
    renewsAt: dayFromNow(19),
  });
  summary.subscriptions += 3;
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
  if (profile === "blank") {
    return summary;
  }

  if (profile === "developer") {
    await addDeveloperTasks(userId, summary);

    const growth = await importSamplePortfolio(userId);
    summary.projectsAdded = growth.projectsAdded;
    summary.skillsAdded = growth.skillsAdded;

    await addDeveloperJobs(userId, summary);
    await addHabits(userId, summary, DEVELOPER_HABITS);
    await addDeveloperGoals(userId, summary);
    await addDeveloperNotes(userId, summary);
    await addDeveloperLearning(userId, summary);
    await addDeveloperFinance(userId, summary);
    await addDeveloperCv(userId, summary);

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

  const starterTasks =
    profile === "freelancer"
      ? ["Send the weekly client update", "Review the proposal", "Log billable time"]
      : [
          "Write the weekly update",
          "Review this week's priorities",
          "Follow up with the recruiter",
        ];
  await addTasks(userId, summary, starterTasks);

  if (profile === "student") {
    await addHabits(userId, summary, STUDENT_HABITS);
    const distributed = await createCourse(userId, {
      title: "Distributed systems",
      provider: "MIT OCW (sample)",
    });
    await setCourseProgress(userId, { courseId: distributed.id, progress: 40 });
    const statistics = await createCourse(userId, {
      title: "Intro to statistics",
      provider: "Open textbook (sample)",
    });
    await setCourseProgress(userId, { courseId: statistics.id, progress: 20 });
    summary.courses += 2;
    await createBook(userId, {
      title: "Designing Data-Intensive Applications",
      author: "Martin Kleppmann",
      status: "reading",
    });
    await createBook(userId, { title: "How to Take Smart Notes", author: "Sönke Ahrens" });
    summary.books += 2;
    const exam = await createGoal(userId, { title: "Pass the algorithms exam", period: "2026-Q4" });
    summary.goals += 1;
    const sets = await createKeyResult(userId, {
      goalId: exam.id,
      title: "Practice sets finished",
      kind: "number",
      target: 12,
    });
    await setKeyResultValue(userId, { keyResultId: sets.id, current: 5 });
    summary.keyResults += 1;
    await createNote(userId, {
      title: "Study plan",
      body: "## This week\n- Two study blocks a day\n- One practice set\n\n_Sample content._",
    });
    summary.notes += 1;
    return summary;
  }

  if (profile === "freelancer") {
    await addHabits(userId, summary, FREELANCER_HABITS);
    await createBoard(userId, { name: "Clients", template: "daily-kanban" });
    const retainers = await createGoal(userId, {
      title: "Three retainer clients",
      period: "2026-Q4",
    });
    summary.goals += 1;
    const signed = await createKeyResult(userId, {
      goalId: retainers.id,
      title: "Retainers signed",
      kind: "number",
      target: 3,
    });
    await setKeyResultValue(userId, { keyResultId: signed.id, current: 1 });
    summary.keyResults += 1;
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
