import { and, desc, eq, isNull, lt, or, sql, type AnyColumn } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import {
  cards,
  companies,
  health_logs,
  job_applications,
  notes,
  transactions,
} from "@/server/db/schema";
import { createJob, updateJob } from "@/server/career";
import {
  createAccount,
  addTransaction,
  createSubscription,
  deleteSubscription,
  listAccounts,
  listSubscriptions,
} from "@/server/finance";
import { createHabit, listHabits } from "@/server/habits";
import { listGoals, createGoal, updateGoal } from "@/server/goals";
import { logHealth } from "@/server/health";
import { createBook, createCourse, listBooks, listCourses } from "@/server/learning";
import { createNote, getNote, updateNote, deleteNote } from "@/server/notes";
import { listNotifications, markNotificationRead } from "@/server/notifications";
import { completeReview, listReviews } from "@/server/reviews";
import type { KeysetCursorLike } from "./cards";

/**
 * The REST resource registry (spec §9.1, ADR-070). Each entry is a thin adapter over the owning
 * service with a scope, an optional request schema and a keyset/derived list — so a new resource is
 * one object, and the dynamic `/api/v1/[resource]` routes serve them all.
 *
 * Derived, per-user-bounded lists (habits, goals, accounts, subscriptions, courses, books, reviews,
 * notifications) paginate the list the service already returns; the large tables (jobs, notes,
 * transactions, health) page in SQL on `(created_at, id)`.
 */

export interface ResourceListQuery {
  limit: number;
  cursor: KeysetCursorLike | null;
  params: URLSearchParams;
}

export interface ResourceDef {
  readScope: string;
  writeScope: string;
  createSchema?: z.ZodType;
  updateSchema?: z.ZodType;
  list: (
    userId: string,
    query: ResourceListQuery,
  ) => Promise<{
    items: unknown[];
    nextCursor: KeysetCursorLike | null;
  }>;
  create?: (userId: string, body: unknown) => Promise<unknown>;
  get?: (userId: string, id: string) => Promise<unknown | null>;
  update?: (userId: string, id: string, body: unknown) => Promise<unknown | null>;
  remove?: (userId: string, id: string) => Promise<boolean>;
}

const iso = (value: Date | string | null | undefined): string | null =>
  value === null || value === undefined ? null : new Date(value).toISOString();

/** Compute the next cursor for an already-fetched page (rows must be newest first). */
export function pageOf<T extends { created_at: Date | string; id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: KeysetCursorLike | null } {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor =
    rows.length > limit && last ? { createdAt: iso(last.created_at) as string, id: last.id } : null;
  return { items, nextCursor };
}

/** SQL keyset predicate for `(created_at, id)` descending pages. */
function keyset(createdAt: AnyColumn, id: AnyColumn, cursor: KeysetCursorLike) {
  const at = new Date(cursor.createdAt);
  return or(lt(createdAt, at), and(eq(createdAt, at), lt(id, cursor.id)));
}

const takePage = <T extends { created_at: Date; id: string }>(rows: T[], limit: number) =>
  pageOf(rows, limit);

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const jobCreate = z.object({
  title: z.string().trim().min(1).max(300),
  companyName: z.string().trim().max(200).nullable().optional(),
  source: z.string().trim().max(120).nullable().optional(),
  url: z.string().trim().max(2_000).nullable().optional(),
  workMode: z.enum(["remote", "hybrid", "onsite"]).nullable().optional(),
  excitement: z.number().int().min(1).max(5).nullable().optional(),
});
const jobUpdate = z.object({
  source: z.string().trim().max(120).nullable().optional(),
  url: z.string().trim().max(2_000).nullable().optional(),
  workMode: z.enum(["remote", "hybrid", "onsite"]).nullable().optional(),
  excitement: z.number().int().min(1).max(5).nullable().optional(),
  archived: z.boolean().optional(),
});

const noteCreate = z.object({
  title: z.string().trim().max(500).optional(),
  body: z.string().max(50_000).optional(),
});
const noteUpdate = z.object({
  title: z.string().trim().max(500).optional(),
  body: z.string().max(50_000).optional(),
  pinned: z.boolean().optional(),
});

const habitCreate = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["binary", "numeric"]).optional(),
  target: z.number().int().min(1).max(100_000).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
});

const goalCreate = z.object({
  title: z.string().trim().min(1).max(300),
  period: z.string().trim().max(40).nullable().optional(),
});
const goalUpdate = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  status: z.enum(["active", "done", "dropped"]).optional(),
});

const accountCreate = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.string().trim().max(40).optional(),
  currency: z.string().trim().length(3),
  openingMinor: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
});
const transactionCreate = z.object({
  accountId: z.string().min(1),
  amountMinor: z.number().int().min(-1_000_000_000).max(1_000_000_000),
  currency: z.string().trim().length(3).optional(),
  category: z.string().trim().max(80).nullable().optional(),
  merchant: z.string().trim().max(120).nullable().optional(),
});
const subscriptionCreate = z.object({
  name: z.string().trim().min(1).max(120),
  amountMinor: z.number().int().min(0).max(1_000_000_000),
  currency: z.string().trim().length(3),
  cadence: z.enum(["month", "year"]).optional(),
  renewsAt: z.iso.datetime().nullable().optional(),
});

const healthCreate = z.object({
  kind: z.enum(["sleep", "workout", "water", "mood", "weight"]),
  value: z.number().min(0).max(1_000_000),
  unit: z.string().trim().max(40).nullable().optional(),
  date: z.iso.date().optional(),
  note: z.string().trim().max(1_000).nullable().optional(),
});

const courseCreate = z.object({
  title: z.string().trim().min(1).max(300),
  provider: z.string().trim().max(200).nullable().optional(),
  url: z.string().trim().max(2_000).nullable().optional(),
  deadline: z.iso.datetime().nullable().optional(),
});
const bookCreate = z.object({
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().max(200).nullable().optional(),
  totalPages: z.number().int().min(1).max(100_000).nullable().optional(),
});

const reviewCreate = z.object({
  period: z.enum(["weekly", "monthly"]).optional(),
  answers: z.object({
    wins: z.string().max(20_000),
    lessons: z.string().max(20_000),
    next: z.string().max(20_000),
    clearedInbox: z.boolean(),
    reviewedBoards: z.boolean(),
    reviewedGoals: z.boolean(),
  }),
});

const notificationUpdate = z.object({ read: z.literal(true) });

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export const RESOURCES: Record<string, ResourceDef> = {
  jobs: {
    readScope: "read:*",
    writeScope: "write:jobs",
    createSchema: jobCreate,
    updateSchema: jobUpdate,
    list: async (userId, { limit, cursor, params }) => {
      const q = params.get("q");
      const filters = [eq(job_applications.user_id, userId), isNull(cards.deleted_at)];
      if (q) filters.push(sql`lower(${cards.title}) like ${`%${q.toLowerCase()}%`}`);
      if (cursor) {
        const keysetClause = keyset(job_applications.created_at, job_applications.id, cursor);
        if (keysetClause) filters.push(keysetClause);
      }
      const rows = await db
        .select({ application: job_applications, title: cards.title, company: companies.name })
        .from(job_applications)
        .innerJoin(cards, eq(cards.id, job_applications.card_id))
        .leftJoin(companies, eq(companies.id, job_applications.company_id))
        .where(and(...filters))
        .orderBy(desc(job_applications.created_at), desc(job_applications.id))
        .limit(limit + 1);
      const page = takePage(
        rows.map((row) => ({ ...row.application, title: row.title, company: row.company })),
        limit,
      );
      return {
        items: page.items.map((row) => ({
          id: row.id,
          card_id: row.card_id,
          title: row.title,
          company: row.company,
          source: row.source,
          url: row.url,
          work_mode: row.work_mode,
          excitement: row.excitement,
          created_at: iso(row.created_at),
        })),
        nextCursor: page.nextCursor,
      };
    },
    create: async (userId, body) => {
      const input = jobCreate.parse(body);
      const { card, application } = await createJob(userId, input);
      return {
        id: application.id,
        card_id: card.id,
        title: card.title,
        created_at: iso(application.created_at),
      };
    },
    get: async (userId, id) => {
      const [row] = await db
        .select()
        .from(job_applications)
        .where(and(eq(job_applications.id, id), eq(job_applications.user_id, userId)))
        .limit(1);
      return row
        ? {
            id: row.id,
            card_id: row.card_id,
            source: row.source,
            url: row.url,
            created_at: iso(row.created_at),
          }
        : null;
    },
    update: async (userId, id, body) => {
      const input = jobUpdate.parse(body);
      try {
        const row = await updateJob(userId, { applicationId: id, ...input });
        return { id: row.id, source: row.source, url: row.url };
      } catch {
        return null;
      }
    },
  },

  notes: {
    readScope: "read:*",
    writeScope: "write:notes",
    createSchema: noteCreate,
    updateSchema: noteUpdate,
    list: async (userId, { limit, cursor, params }) => {
      const q = params.get("q");
      const filters = [eq(notes.user_id, userId), isNull(notes.deleted_at)];
      if (q) filters.push(sql`lower(${notes.title}) like ${`%${q.toLowerCase()}%`}`);
      if (cursor) {
        const clause = keyset(notes.created_at, notes.id, cursor);
        if (clause) filters.push(clause);
      }
      const rows = await db
        .select()
        .from(notes)
        .where(and(...filters))
        .orderBy(desc(notes.created_at), desc(notes.id))
        .limit(limit + 1);
      const page = takePage(rows, limit);
      return {
        items: page.items.map((row) => ({
          id: row.id,
          title: row.title,
          kind: row.kind,
          pinned: row.pinned,
          created_at: iso(row.created_at),
        })),
        nextCursor: page.nextCursor,
      };
    },
    create: async (userId, body) => {
      const row = await createNote(userId, noteCreate.parse(body));
      return { id: row.id, title: row.title, kind: row.kind, created_at: iso(row.created_at) };
    },
    get: async (userId, id) => {
      const detail = await getNote(userId, id).catch(() => null);
      if (!detail) return null;
      return {
        id: detail.note.id,
        title: detail.note.title,
        body: detail.note.body,
        kind: detail.note.kind,
        pinned: detail.note.pinned,
        backlinks: detail.backlinks.map((backlink) => ({ id: backlink.id, title: backlink.title })),
        created_at: iso(detail.note.created_at),
      };
    },
    update: async (userId, id, body) => {
      const input = noteUpdate.parse(body);
      try {
        const row = await updateNote(userId, { noteId: id, ...input });
        return { id: row.id, title: row.title, pinned: row.pinned };
      } catch {
        return null;
      }
    },
    remove: async (userId, id) => {
      try {
        await deleteNote(userId, id);
        return true;
      } catch {
        return false;
      }
    },
  },

  habits: {
    readScope: "read:*",
    writeScope: "write:life",
    createSchema: habitCreate,
    list: async (userId) => {
      const views = await listHabits(userId);
      return {
        items: views.map((view) => ({
          id: view.habit.id,
          name: view.habit.name,
          cadence: view.habit.cadence,
          kind: view.habit.kind,
          target: view.habit.target,
          unit: view.habit.unit,
          today: view.value,
          streak: view.streak,
        })),
        nextCursor: null,
      };
    },
    create: async (userId, body) => {
      const row = await createHabit(userId, habitCreate.parse(body));
      return { id: row.id, name: row.name, kind: row.kind };
    },
  },

  goals: {
    readScope: "read:*",
    writeScope: "write:life",
    createSchema: goalCreate,
    updateSchema: goalUpdate,
    list: async (userId) => {
      const views = await listGoals(userId);
      return {
        items: views.map((view) => ({
          id: view.goal.id,
          title: view.goal.title,
          period: view.goal.period,
          status: view.goal.status,
          progress: view.progress,
        })),
        nextCursor: null,
      };
    },
    create: async (userId, body) => {
      const row = await createGoal(userId, goalCreate.parse(body));
      return { id: row.id, title: row.title, status: row.status };
    },
    update: async (userId, id, body) => {
      const input = goalUpdate.parse(body);
      try {
        const row = await updateGoal(userId, { goalId: id, ...input });
        return { id: row.id, title: row.title, status: row.status };
      } catch {
        return null;
      }
    },
  },

  accounts: {
    readScope: "read:*",
    writeScope: "write:finance",
    createSchema: accountCreate,
    list: async (userId) => {
      const views = await listAccounts(userId);
      return {
        items: views.map((view) => ({
          id: view.account.id,
          name: view.account.name,
          kind: view.account.kind,
          currency: view.account.currency,
          balanceMinor: view.balanceMinor,
        })),
        nextCursor: null,
      };
    },
    create: async (userId, body) => {
      const row = await createAccount(userId, accountCreate.parse(body));
      return { id: row.id, name: row.name, currency: row.currency };
    },
  },

  transactions: {
    readScope: "read:*",
    writeScope: "write:finance",
    createSchema: transactionCreate,
    list: async (userId, { limit, cursor }) => {
      const filters = [eq(transactions.user_id, userId)];
      if (cursor) {
        const clause = keyset(transactions.created_at, transactions.id, cursor);
        if (clause) filters.push(clause);
      }
      const rows = await db
        .select()
        .from(transactions)
        .where(and(...filters))
        .orderBy(desc(transactions.created_at), desc(transactions.id))
        .limit(limit + 1);
      const page = takePage(rows, limit);
      return {
        items: page.items.map((row) => ({
          id: row.id,
          account_id: row.account_id,
          amount_minor: row.amount_minor,
          currency: row.currency,
          category: row.category,
          merchant: row.merchant,
          occurred_at: iso(row.occurred_at),
          created_at: iso(row.created_at),
        })),
        nextCursor: page.nextCursor,
      };
    },
    create: async (userId, body) => {
      const row = await addTransaction(userId, transactionCreate.parse(body));
      return { id: row.id, account_id: row.account_id, amount_minor: row.amount_minor };
    },
  },

  subscriptions: {
    readScope: "read:*",
    writeScope: "write:finance",
    createSchema: subscriptionCreate,
    list: async (userId) => {
      const views = await listSubscriptions(userId);
      return {
        items: views.map((view) => ({
          id: view.subscription.id,
          name: view.subscription.name,
          amount_minor: view.subscription.amount_minor,
          currency: view.subscription.currency,
          cadence: view.subscription.cadence,
          due_in_days: view.dueInDays,
        })),
        nextCursor: null,
      };
    },
    create: async (userId, body) => {
      const input = subscriptionCreate.parse(body);
      const row = await createSubscription(userId, {
        ...input,
        renewsAt: input.renewsAt ? new Date(input.renewsAt) : null,
      });
      return { id: row.id, name: row.name, currency: row.currency };
    },
    remove: async (userId, id) => {
      await deleteSubscription(userId, id);
      return true;
    },
  },

  health: {
    readScope: "read:*",
    writeScope: "write:life",
    createSchema: healthCreate,
    list: async (userId, { limit, cursor }) => {
      const filters = [eq(health_logs.user_id, userId)];
      if (cursor) {
        const clause = keyset(health_logs.created_at, health_logs.id, cursor);
        if (clause) filters.push(clause);
      }
      const rows = await db
        .select()
        .from(health_logs)
        .where(and(...filters))
        .orderBy(desc(health_logs.created_at), desc(health_logs.id))
        .limit(limit + 1);
      const page = takePage(rows, limit);
      return {
        items: page.items.map((row) => ({
          id: row.id,
          kind: row.kind,
          value: row.value,
          unit: row.unit,
          date: row.date,
          created_at: iso(row.created_at),
        })),
        nextCursor: page.nextCursor,
      };
    },
    create: async (userId, body) => {
      const row = await logHealth(userId, healthCreate.parse(body));
      return { id: row.id, kind: row.kind, value: row.value, date: row.date };
    },
  },

  courses: {
    readScope: "read:*",
    writeScope: "write:life",
    createSchema: courseCreate,
    list: async (userId) => {
      const rows = await listCourses(userId);
      return {
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          provider: row.provider,
          progress: row.progress,
        })),
        nextCursor: null,
      };
    },
    create: async (userId, body) => {
      const input = courseCreate.parse(body);
      const row = await createCourse(userId, {
        ...input,
        deadline: input.deadline ? new Date(input.deadline) : null,
      });
      return { id: row.id, title: row.title };
    },
  },

  books: {
    readScope: "read:*",
    writeScope: "write:life",
    createSchema: bookCreate,
    list: async (userId) => {
      const rows = await listBooks(userId);
      return {
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          author: row.author,
          status: row.status,
        })),
        nextCursor: null,
      };
    },
    create: async (userId, body) => {
      const row = await createBook(userId, bookCreate.parse(body));
      return { id: row.id, title: row.title, status: row.status };
    },
  },

  reviews: {
    readScope: "read:*",
    writeScope: "write:life",
    createSchema: reviewCreate,
    list: async (userId) => {
      const rows = await listReviews(userId);
      return {
        items: rows.map((row) => ({
          id: row.id,
          period: row.period,
          note_id: row.note_id,
          started_at: iso(row.started_at),
        })),
        nextCursor: null,
      };
    },
    create: async (userId, body) => {
      const row = await completeReview(userId, reviewCreate.parse(body));
      return { id: row.id, period: row.period, note_id: row.note_id };
    },
  },

  notifications: {
    readScope: "read:*",
    writeScope: "write:life",
    updateSchema: notificationUpdate,
    list: async (userId) => {
      const { items } = await listNotifications(userId);
      return {
        items: items.map((item) => ({
          id: item.id,
          kind: item.kind,
          title: item.title,
          href: item.href,
          read_at: item.readAt,
          created_at: item.createdAt,
        })),
        nextCursor: null,
      };
    },
    get: async (userId, id) => {
      const { items } = await listNotifications(userId);
      const item = items.find((row) => row.id === id);
      return item
        ? { id: item.id, kind: item.kind, title: item.title, read_at: item.readAt }
        : null;
    },
    update: async (userId, id, body) => {
      notificationUpdate.parse(body);
      const current = await RESOURCES.notifications?.get?.(userId, id);
      if (!current) return null;
      await markNotificationRead(userId, id);
      return { id, read: true };
    },
  },
};

export const RESOURCE_NAMES = Object.keys(RESOURCES);
