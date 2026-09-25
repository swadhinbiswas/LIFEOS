import { eq } from "drizzle-orm";

import { toCsv } from "@/lib/csv";
import { db } from "@/server/db";
import {
  accounts_fin,
  achievements,
  boards,
  books,
  budgets,
  cards,
  companies,
  courses,
  focus_sessions,
  goal_links,
  goals,
  habit_logs,
  habits,
  health_logs,
  interviews,
  job_applications,
  key_results,
  notes,
  offers,
  projects,
  question_bank,
  reminders,
  reviews,
  saved_views,
  skills,
  star_stories,
  subscriptions_tracked,
  taggings,
  tags,
  time_entries,
  transactions,
} from "@/server/db/schema";

/**
 * Data ownership export (spec §10, ADR-083). Read-only aggregation of every module this account
 * owns, scoped by `user_id`, assembled in a plain JSON shape that the matching import understands.
 * This is a **reader** of other modules' tables, deliberately in one place so the export and the
 * import stay in step and no service has to grow an export-only function.
 */

export interface DataExport {
  version: 1;
  exportedAt: string;
  account: { name: string; email: string };
  boards: unknown[];
  cards: unknown[];
  tags: unknown[];
  taggings: unknown[];
  notes: unknown[];
  habits: unknown[];
  habitLogs: unknown[];
  goals: unknown[];
  keyResults: unknown[];
  goalLinks: unknown[];
  accounts: unknown[];
  transactions: unknown[];
  budgets: unknown[];
  subscriptions: unknown[];
  healthLogs: unknown[];
  courses: unknown[];
  books: unknown[];
  focusSessions: unknown[];
  reviews: unknown[];
  timeEntries: unknown[];
  reminders: unknown[];
  savedViews: unknown[];
  companies: unknown[];
  jobApplications: unknown[];
  interviews: unknown[];
  offers: unknown[];
  skills: unknown[];
  achievements: unknown[];
  projects: unknown[];
  starStories: unknown[];
  questionBank: unknown[];
}

export async function exportAll(
  userId: string,
  account: { name: string; email: string },
): Promise<DataExport> {
  const [
    boardRows,
    cardRows,
    tagRows,
    taggingRows,
    noteRows,
    habitRows,
    habitLogRows,
    goalRows,
    keyResultRows,
    goalLinkRows,
    accountRows,
    transactionRows,
    budgetRows,
    subscriptionRows,
    healthRows,
    courseRows,
    bookRows,
    focusRows,
    reviewRows,
    timeRows,
    reminderRows,
    savedViewRows,
    companyRows,
    jobRows,
    interviewRows,
    offerRows,
    skillRows,
    achievementRows,
    projectRows,
    starRows,
    questionRows,
  ] = await Promise.all([
    db.select().from(boards).where(eq(boards.user_id, userId)),
    db.select().from(cards).where(eq(cards.user_id, userId)),
    db.select().from(tags).where(eq(tags.user_id, userId)),
    db.select().from(taggings).where(eq(taggings.user_id, userId)),
    db.select().from(notes).where(eq(notes.user_id, userId)),
    db.select().from(habits).where(eq(habits.user_id, userId)),
    db.select().from(habit_logs).where(eq(habit_logs.user_id, userId)),
    db.select().from(goals).where(eq(goals.user_id, userId)),
    db.select().from(key_results).where(eq(key_results.user_id, userId)),
    db.select().from(goal_links).where(eq(goal_links.user_id, userId)),
    db.select().from(accounts_fin).where(eq(accounts_fin.user_id, userId)),
    db.select().from(transactions).where(eq(transactions.user_id, userId)),
    db.select().from(budgets).where(eq(budgets.user_id, userId)),
    db.select().from(subscriptions_tracked).where(eq(subscriptions_tracked.user_id, userId)),
    db.select().from(health_logs).where(eq(health_logs.user_id, userId)),
    db.select().from(courses).where(eq(courses.user_id, userId)),
    db.select().from(books).where(eq(books.user_id, userId)),
    db.select().from(focus_sessions).where(eq(focus_sessions.user_id, userId)),
    db.select().from(reviews).where(eq(reviews.user_id, userId)),
    db.select().from(time_entries).where(eq(time_entries.user_id, userId)),
    db.select().from(reminders).where(eq(reminders.user_id, userId)),
    db.select().from(saved_views).where(eq(saved_views.user_id, userId)),
    db.select().from(companies).where(eq(companies.user_id, userId)),
    db.select().from(job_applications).where(eq(job_applications.user_id, userId)),
    db.select().from(interviews).where(eq(interviews.user_id, userId)),
    db.select().from(offers).where(eq(offers.user_id, userId)),
    db.select().from(skills).where(eq(skills.user_id, userId)),
    db.select().from(achievements).where(eq(achievements.user_id, userId)),
    db.select().from(projects).where(eq(projects.user_id, userId)),
    db.select().from(star_stories).where(eq(star_stories.user_id, userId)),
    db.select().from(question_bank).where(eq(question_bank.user_id, userId)),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    account,
    boards: boardRows,
    cards: cardRows,
    tags: tagRows,
    taggings: taggingRows,
    notes: noteRows,
    habits: habitRows,
    habitLogs: habitLogRows,
    goals: goalRows,
    keyResults: keyResultRows,
    goalLinks: goalLinkRows,
    accounts: accountRows,
    transactions: transactionRows,
    budgets: budgetRows,
    subscriptions: subscriptionRows,
    healthLogs: healthRows,
    courses: courseRows,
    books: bookRows,
    focusSessions: focusRows,
    reviews: reviewRows,
    timeEntries: timeRows,
    reminders: reminderRows,
    savedViews: savedViewRows,
    companies: companyRows,
    jobApplications: jobRows,
    interviews: interviewRows,
    offers: offerRows,
    skills: skillRows,
    achievements: achievementRows,
    projects: projectRows,
    starStories: starRows,
    questionBank: questionRows,
  };
}

/** Modules a per-module CSV can be produced for. */
export const CSV_MODULES = [
  "cards",
  "habits",
  "habitLogs",
  "goals",
  "notes",
  "transactions",
  "skills",
  "projects",
  "achievements",
  "jobApplications",
] as const;

export type CsvModule = (typeof CSV_MODULES)[number];

const CSV_COLUMNS: Record<CsvModule, string[]> = {
  cards: [
    "id",
    "board_id",
    "column_id",
    "title",
    "priority",
    "due_at",
    "estimate_min",
    "created_at",
  ],
  habits: ["id", "name", "kind", "target", "unit", "created_at"],
  habitLogs: ["habit_id", "date", "value", "note"],
  goals: ["id", "title", "period", "status", "created_at"],
  notes: ["id", "title", "kind", "daily_date", "created_at"],
  transactions: [
    "id",
    "account_id",
    "amount_minor",
    "currency",
    "category",
    "merchant",
    "occurred_at",
  ],
  skills: ["id", "name", "level", "created_at"],
  projects: ["id", "name", "description", "url", "language", "stars", "created_at"],
  achievements: ["id", "title", "impact", "created_at"],
  jobApplications: [
    "id",
    "card_id",
    "company_id",
    "source",
    "work_mode",
    "salary_min",
    "salary_max",
    "currency",
    "created_at",
  ],
};

export function moduleCsv(module: CsvModule, rows: unknown[]): string {
  return toCsv(rows as Array<Record<string, unknown>>, CSV_COLUMNS[module]);
}

/** One Markdown document with every note, so notes survive as text, not as JSON. */
export function notesToMarkdown(rows: Array<Record<string, unknown>>): string {
  const parts = rows.map((note) => {
    const title = String(note.title ?? "") || "(untitled)";
    const date = note.daily_date ? String(note.daily_date) : "";
    return `# ${title}${date ? ` — ${date}` : ""}\n\n${String(note.body ?? "")}`;
  });
  return `# Notes\n\n${parts.join("\n\n---\n\n")}\n`;
}

/**
 * JSON Resume (spec §9.3). Built only from data the user actually entered: their name, their
 * skills and their projects. Nothing is invented; empty sections are omitted rather than faked.
 */
export function toJsonResume(input: {
  name: string;
  skills: Array<{ name: string; level?: number | null }>;
  projects: Array<{
    name: string;
    description?: string | null;
    url?: string | null;
    language?: string | null;
  }>;
}): Record<string, unknown> {
  return {
    basics: { name: input.name },
    skills: input.skills.map((skill) => ({
      name: skill.name,
      ...(skill.level ? { level: String(skill.level) } : {}),
    })),
    projects: input.projects.map((project) => ({
      name: project.name,
      ...(project.description ? { description: project.description } : {}),
      ...(project.url ? { url: project.url } : {}),
      ...(project.language ? { keywords: [project.language] } : {}),
    })),
  };
}
