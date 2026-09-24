import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import {
  board_columns,
  boards,
  cards,
  companies,
  interviews,
  job_applications,
  offers,
} from "@/server/db/schema";
import { emitEvent } from "@/server/webhooks";
import {
  BoardError,
  createBoard,
  createCard,
  getBoard,
  moveCard,
  type Board,
  type Card,
} from "@/server/boards";

import type {
  AddInterviewInput,
  AddOfferInput,
  CreateJobInput,
  MoveJobStageInput,
  UpdateJobInput,
} from "./schemas";

/**
 * Career service (spec §6.3, ADR-044). A job is a card, so ordering, versions and views stay
 * with the board service; this module owns the `job_applications` side table and the
 * **append-only stage history** the funnel is derived from. Single writer, like every service:
 * actions, REST/MCP and AI tools all call these functions.
 */

const JOB_TEMPLATE = "job-pipeline";
const DEFAULT_STAGE = "Wishlist";

export interface StageEntry {
  from: string | null;
  to: string;
  at: string;
}

export type JobApplication = typeof job_applications.$inferSelect;

function parseHistory(raw: string): StageEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StageEntry[]) : [];
  } catch {
    return [];
  }
}

/** The user's job board, created from the spec's pipeline template on first use. */
export async function ensureJobBoard(userId: string): Promise<Board> {
  const [existing] = await db
    .select()
    .from(boards)
    .where(
      and(eq(boards.user_id, userId), eq(boards.template, JOB_TEMPLATE), isNull(boards.deleted_at)),
    )
    .limit(1);
  if (existing) return existing;
  return createBoard(userId, { name: "Jobs", template: JOB_TEMPLATE });
}

/** Companies are matched case-insensitively so "Acme" and "acme" are one record. */
export async function ensureCompany(
  userId: string,
  name: string,
  extra: Partial<typeof companies.$inferInsert> = {},
): Promise<string> {
  const [existing] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.user_id, userId),
        sql`lower(${companies.name}) = ${name.trim().toLowerCase()}`,
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(companies)
    .values({ id: newId(), user_id: userId, name: name.trim(), ...extra })
    .returning({ id: companies.id });
  if (!created) throw new BoardError("invalid", "company insert returned no row");
  return created.id;
}

export interface JobWithCard {
  card: Card;
  application: JobApplication;
}

export async function createJob(userId: string, input: CreateJobInput): Promise<JobWithCard> {
  const board = await ensureJobBoard(userId);
  const payload = await getBoard(userId, board.id);
  const column =
    payload.columns.find((candidate) => candidate.name === (input.columnName ?? DEFAULT_STAGE)) ??
    payload.columns[0];
  if (!column) throw new BoardError("not_found", "the job board has no columns");

  const card = await createCard(userId, {
    boardId: board.id,
    columnId: column.id,
    title: input.title,
    kind: "job",
    dueAt: input.dueAt ?? null,
  });

  const companyId = input.companyName ? await ensureCompany(userId, input.companyName) : null;
  const history: StageEntry[] = [{ from: null, to: column.name, at: new Date().toISOString() }];

  const [application] = await db
    .insert(job_applications)
    .values({
      id: newId(),
      user_id: userId,
      card_id: card.id,
      company_id: companyId,
      stage_history: JSON.stringify(history),
      salary_min: input.salaryMin ?? null,
      salary_max: input.salaryMax ?? null,
      currency: input.currency ?? null,
      work_mode: input.workMode ?? null,
      visa_status: input.visaStatus ?? null,
      source: input.source ?? null,
      url: input.url ?? null,
      jd_snapshot: input.jdSnapshot ?? null,
      excitement: input.excitement ?? null,
      fit_score: input.fitScore ?? null,
    })
    .returning();
  if (!application) throw new BoardError("invalid", "job insert returned no row");

  return { card, application };
}

async function requireApplication(userId: string, applicationId: string): Promise<JobApplication> {
  const [application] = await db
    .select()
    .from(job_applications)
    .where(and(eq(job_applications.id, applicationId), eq(job_applications.user_id, userId)))
    .limit(1);
  if (!application) throw new BoardError("not_found", "job not found");
  return application;
}

export async function updateJob(userId: string, input: UpdateJobInput): Promise<JobApplication> {
  await requireApplication(userId, input.applicationId);
  const patch: Partial<typeof job_applications.$inferInsert> = {};
  if (input.url !== undefined) patch.url = input.url;
  if (input.source !== undefined) patch.source = input.source;
  if (input.workMode !== undefined) patch.work_mode = input.workMode;
  if (input.visaStatus !== undefined) patch.visa_status = input.visaStatus;
  if (input.salaryMin !== undefined) patch.salary_min = input.salaryMin;
  if (input.salaryMax !== undefined) patch.salary_max = input.salaryMax;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.jdSnapshot !== undefined) patch.jd_snapshot = input.jdSnapshot;
  if (input.coverLetter !== undefined) patch.cover_letter = input.coverLetter;
  if (input.excitement !== undefined) patch.excitement = input.excitement;
  if (input.fitScore !== undefined) patch.fit_score = input.fitScore;
  if (input.archived !== undefined) patch.archived_at = input.archived ? new Date() : null;
  if (input.companyName !== undefined) {
    patch.company_id = input.companyName ? await ensureCompany(userId, input.companyName) : null;
  }

  const [row] = await db
    .update(job_applications)
    .set(patch)
    .where(and(eq(job_applications.id, input.applicationId), eq(job_applications.user_id, userId)))
    .returning();
  if (!row) throw new BoardError("not_found", "job not found");
  return row;
}

/**
 * Move a job to another stage: the card move goes through `moveCard` (ordering, versions,
 * ADR-009 retry) and the stage history then records what happened, append-only.
 */
export async function moveJobStage(userId: string, input: MoveJobStageInput): Promise<Card> {
  const application = await requireApplication(userId, input.applicationId);

  const [current] = await db
    .select({ name: board_columns.name })
    .from(cards)
    .innerJoin(board_columns, eq(board_columns.id, cards.column_id))
    .where(and(eq(cards.id, application.card_id), eq(cards.user_id, userId)))
    .limit(1);

  const [stage] = await db
    .select({ id: board_columns.id, name: board_columns.name })
    .from(board_columns)
    .where(and(eq(board_columns.id, input.toColumnId), eq(board_columns.user_id, userId)))
    .limit(1);
  if (!stage) throw new BoardError("not_found", "stage not found");

  const card = await moveCard(userId, {
    cardId: application.card_id,
    version: input.version,
    toColumnId: input.toColumnId,
    prevCardId: input.prevCardId,
    nextCardId: input.nextCardId,
  });

  const history = parseHistory(application.stage_history);
  history.push({ from: current?.name ?? null, to: stage.name, at: new Date().toISOString() });
  await db
    .update(job_applications)
    .set({ stage_history: JSON.stringify(history) })
    .where(and(eq(job_applications.id, application.id), eq(job_applications.user_id, userId)));

  await emitEvent(userId, "job.stage_changed", {
    applicationId: application.id,
    cardId: application.card_id,
    from: current?.name ?? null,
    to: stage.name,
  });

  return card;
}

/** Chip data for the job board's card faces, keyed by card id (the tasks board passes none). */
export interface JobCardMeta {
  label: string;
  detailHref?: string;
}

export async function getJobMeta(userId: string): Promise<Record<string, JobCardMeta[]>> {
  const rows = await db
    .select({
      cardId: job_applications.card_id,
      company: companies.name,
      excitement: job_applications.excitement,
      source: job_applications.source,
    })
    .from(job_applications)
    .leftJoin(companies, eq(companies.id, job_applications.company_id))
    .where(eq(job_applications.user_id, userId));

  const meta: Record<string, JobCardMeta[]> = {};
  for (const row of rows) {
    const chips: JobCardMeta[] = [];
    if (row.company) chips.push({ label: row.company });
    if (row.excitement !== null) chips.push({ label: `★${row.excitement}` });
    if (row.source) chips.push({ label: row.source });
    // The board leads to the job's own page; the card sheet stays for quick edits.
    chips.push({ label: "detail →", detailHref: `/career/jobs/${row.cardId}` });
    meta[row.cardId] = chips;
  }
  return meta;
}

export interface JobDetail {
  card: Card;
  application: JobApplication;
  company: { id: string; name: string } | null;
  interviews: Array<typeof interviews.$inferSelect>;
  offers: Array<typeof offers.$inferSelect>;
}

/** The job's page: application fields, company, interview log and offers. Null when unknown. */
export async function getJobDetail(userId: string, cardId: string): Promise<JobDetail | null> {
  const [application] = await db
    .select()
    .from(job_applications)
    .where(and(eq(job_applications.user_id, userId), eq(job_applications.card_id, cardId)))
    .limit(1);
  if (!application) return null;

  const [card] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.user_id, userId), isNull(cards.deleted_at)))
    .limit(1);
  if (!card) return null;

  let company: { id: string; name: string } | null = null;
  if (application.company_id) {
    const [row] = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(and(eq(companies.id, application.company_id), eq(companies.user_id, userId)))
      .limit(1);
    company = row ?? null;
  }

  const interviewRows = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.user_id, userId), eq(interviews.job_application_id, application.id)))
    .orderBy(desc(interviews.starts_at));

  const offerRows = await db
    .select()
    .from(offers)
    .where(and(eq(offers.user_id, userId), eq(offers.job_application_id, application.id)))
    .orderBy(desc(offers.received_at));

  return {
    card,
    application,
    company,
    interviews: interviewRows,
    offers: offerRows,
  };
}

export async function addInterview(
  userId: string,
  input: AddInterviewInput,
): Promise<typeof interviews.$inferSelect> {
  await requireApplication(userId, input.applicationId);
  const [row] = await db
    .insert(interviews)
    .values({
      id: newId(),
      user_id: userId,
      job_application_id: input.applicationId,
      kind: input.kind,
      starts_at: input.startsAt ?? null,
      duration_min: input.durationMin ?? null,
      interviewers: input.interviewers ?? null,
      feedback: input.feedback ?? null,
      rating: input.rating ?? null,
    })
    .returning();
  if (!row) throw new BoardError("invalid", "interview insert returned no row");
  return row;
}

export async function addOffer(
  userId: string,
  input: AddOfferInput,
): Promise<typeof offers.$inferSelect> {
  await requireApplication(userId, input.applicationId);
  const [row] = await db
    .insert(offers)
    .values({
      id: newId(),
      user_id: userId,
      job_application_id: input.applicationId,
      base: input.base ?? null,
      equity: input.equity ?? null,
      bonus: input.bonus ?? null,
      currency: input.currency ?? null,
      received_at: input.receivedAt ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new BoardError("invalid", "offer insert returned no row");
  return row;
}

export interface FunnelStage {
  stage: string;
  /** Jobs currently sitting in this stage. */
  count: number;
  /** Mean days this stage held a job, from the stage history (null when never left). */
  averageDaysInStage: number | null;
}

export interface Funnel {
  stages: FunnelStage[];
  total: number;
  /** Response rate: jobs that ever left their first stage / all jobs. */
  responseRate: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Funnel analytics derived from the stage history (research (d) §5, ERD §2.3: no summary
 * table in v1). Time-in-stage pairs each entry's `at` with the following entry's.
 */
export async function getFunnel(userId: string, now: Date = new Date()): Promise<Funnel> {
  const board = await ensureJobBoard(userId);
  const payload = await getBoard(userId, board.id);
  const applications = await db
    .select()
    .from(job_applications)
    .where(eq(job_applications.user_id, userId));

  const cardsById = new Map(payload.cards.map((card) => [card.id, card]));
  const durations = new Map<string, number[]>();

  for (const application of applications) {
    const card = cardsById.get(application.card_id);
    if (!card) continue;
    const history = parseHistory(application.stage_history);
    for (let index = 0; index < history.length; index += 1) {
      const entry = history[index];
      const next = history[index + 1];
      if (!entry) continue;
      const started = new Date(entry.at).getTime();
      const ended = next ? new Date(next.at).getTime() : now.getTime();
      const days = Math.max(0, (ended - started) / DAY_MS);
      const bucket = durations.get(entry.to) ?? [];
      bucket.push(days);
      durations.set(entry.to, bucket);
    }
  }

  const stages = payload.columns.map((column) => {
    const samples = durations.get(column.name) ?? [];
    return {
      stage: column.name,
      count: payload.cards.filter((card) => card.column_id === column.id).length,
      averageDaysInStage:
        samples.length === 0
          ? null
          : Math.round((samples.reduce((total, value) => total + value, 0) / samples.length) * 10) /
            10,
    };
  });

  const total = payload.cards.length;
  const progressed = applications.filter(
    (application) => parseHistory(application.stage_history).length > 1,
  ).length;

  return {
    stages,
    total,
    responseRate: total === 0 ? 0 : Math.round((progressed / total) * 100) / 100,
  };
}
