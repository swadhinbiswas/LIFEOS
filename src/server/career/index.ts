import { and, desc, eq, isNotNull, isNull, notInArray, sql } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import {
  board_columns,
  boards,
  cards,
  companies,
  contacts,
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
  MoveJobToStageInput,
  UpdateInterviewInput,
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
      next_action: input.nextAction ?? null,
      next_action_due: input.nextActionDue ?? null,
      apply_by: input.applyBy ?? null,
      date_applied: input.dateApplied ?? null,
      seniority: input.seniority ?? null,
      apply_email: input.applyEmail ?? null,
      req_id: input.reqId ?? null,
      location: input.location ?? null,
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

/**
 * A contact, tenant-checked. `contacts` predated any link to an application, so the id could come
 * from a stale client; checking ownership here is what stops one user's contact being attached to
 * another user's application.
 */
async function requireContact(userId: string, contactId: string) {
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.user_id, userId)))
    .limit(1);
  if (!contact) throw new BoardError("not_found", "contact not found");
  return contact;
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
  if (input.nextAction !== undefined) patch.next_action = input.nextAction;
  if (input.nextActionDue !== undefined) patch.next_action_due = input.nextActionDue;
  if (input.applyBy !== undefined) patch.apply_by = input.applyBy;
  if (input.dateApplied !== undefined) patch.date_applied = input.dateApplied;
  if (input.seniority !== undefined) patch.seniority = input.seniority;
  if (input.applyEmail !== undefined) patch.apply_email = input.applyEmail;
  if (input.reqId !== undefined) patch.req_id = input.reqId;
  if (input.appId !== undefined) patch.app_id = input.appId;
  if (input.progress !== undefined) patch.progress = input.progress;
  if (input.coverLetterNeeded !== undefined) patch.cover_letter_needed = input.coverLetterNeeded;
  if (input.location !== undefined) patch.location = input.location;
  if (input.contactId !== undefined) {
    // A contact belongs to the user; a foreign id is rejected rather than silently linked, so a
    // stale or guessed id cannot attach someone else's contact to an application.
    if (input.contactId !== null) await requireContact(userId, input.contactId);
    patch.contact_id = input.contactId;
  }
  if (input.companyName !== undefined) {
    patch.company_id = input.companyName ? await ensureCompany(userId, input.companyName) : null;
  }

  // A patch with nothing in it is a read, not an error. Drizzle throws "No values to set" on an
  // empty update, which surfaced as an obscure driver message when the AI tool `update_job_details`
  // was called with only a cardId — a perfectly reasonable thing for a caller to do.
  if (Object.keys(patch).length === 0) return requireApplication(userId, input.applicationId);

  const [row] = await db
    .update(job_applications)
    .set(patch)
    .where(and(eq(job_applications.id, input.applicationId), eq(job_applications.user_id, userId)))
    .returning();
  if (!row) throw new BoardError("not_found", "job not found");
  return row;
}

/** Re-exported for the actions layer; the read is on the service so REST/MCP/AI share it. */
export async function readJob(userId: string, applicationId: string): Promise<JobApplication> {
  return requireApplication(userId, applicationId);
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

/**
 * Move a job to a stage named rather than a column id, landing at the end of that column.
 *
 * The table's stage dropdown and the `move_job_stage` MCP tool both say "this is in Interview now".
 * Neither knows the target column's id, the card's current version, or which card currently sits at
 * the bottom — and all three change underneath any client that cached them. Resolving them here,
 * against the database, at the moment of the call, is the only version that is not a guess.
 *
 * Scoped to the *job* board rather than "any column the user owns with this name", because a Tasks
 * board has a "Done" column too and a job that lands there is invisible on the pipeline.
 */
export async function moveJobToStage(
  userId: string,
  input: MoveJobToStageInput,
): Promise<{ cardId: string; stage: string }> {
  const application = await requireApplication(userId, input.applicationId);
  const board = await ensureJobBoard(userId);

  const [column] = await db
    .select({ id: board_columns.id, name: board_columns.name })
    .from(board_columns)
    .where(
      and(
        eq(board_columns.board_id, board.id),
        eq(board_columns.user_id, userId),
        sql`lower(${board_columns.name}) = lower(${input.toStage})`,
      ),
    )
    .limit(1);
  if (!column) {
    // Naming the stages that do exist is the difference between a fixable call and a guessing loop.
    const available = (
      await db
        .select({ name: board_columns.name })
        .from(board_columns)
        .where(and(eq(board_columns.board_id, board.id), eq(board_columns.user_id, userId)))
        .orderBy(board_columns.position)
    ).map((row) => row.name);
    throw new BoardError(
      "not_found",
      `no stage named "${input.toStage}". stages are: ${available.join(", ")}`,
    );
  }

  const [current] = await db
    .select({ columnId: cards.column_id, version: cards.version })
    .from(cards)
    .where(and(eq(cards.id, application.card_id), eq(cards.user_id, userId)))
    .limit(1);
  if (!current) throw new BoardError("not_found", "job card not found");

  // Already there: say so and do nothing. `moveCard` would still succeed and append a duplicate
  // history entry, which would make "time in stage" count a transition that never happened.
  if (current.columnId === column.id) return { cardId: application.card_id, stage: column.name };

  // Append to the end of the target column, so the optimistic version the caller never had to read
  // is still the one `moveCard` checks (ADR-009).
  const [last] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.column_id, column.id), eq(cards.user_id, userId)))
    .orderBy(desc(cards.position))
    .limit(1);

  const card = await moveJobStage(userId, {
    applicationId: input.applicationId,
    version: current.version,
    toColumnId: column.id,
    prevCardId: last?.id ?? null,
    nextCardId: null,
  });
  return { cardId: card.id, stage: column.name };
}

/** Chip data for the job board's card faces, keyed by card id (the tasks board passes none). */
export interface JobCardMeta {
  label: string;
  detailHref?: string;
}

export interface FollowUp {
  /** The round this row is about, or null when the promise is the application's alone. */
  interviewId: string | null;
  applicationId: string;
  cardId: string;
  company: string | null;
  position: string;
  kind: string;
  dueAt: Date | null;
  status: string;
  preparation: string | null;
  nextAction: string | null;
  /** A due date in the past, and the row is not already done. What makes this list urgent. */
  overdue: boolean;
}

/**
 * Everything the user owes a company, across every application (ADR-114).
 *
 * The reference tracker keeps interviews and follow-ups in one place for a reason: a follow-up has
 * a due date and no start time, so it is invisible to anything that reads `starts_at`. An
 * application is a *promise*, and a promise with a due date that nothing queries is a promise nobody
 * keeps.
 *
 * **One row per promise, not per row in the database.** An application with a next action and three
 * logged rounds is one thing owed, so the two sources are read separately and merged: a follow-up is
 * its own promise, and an application's next action appears on its own line. Selecting across the
 * join instead printed the same application three times, which is worse than not printing it at
 * all — and the test that caught it is why the two reads are separate here.
 */
export async function listFollowUps(
  userId: string,
  now: Date = new Date(),
  includeDone = false,
): Promise<FollowUp[]> {
  const openFilter = includeDone ? undefined : notInArray(interviews.status, ["done", "cancelled"]);

  const [rounds, nextActions] = await Promise.all([
    db
      .select({
        interviewId: interviews.id,
        applicationId: job_applications.id,
        cardId: job_applications.card_id,
        company: companies.name,
        position: cards.title,
        kind: interviews.kind,
        dueAt: interviews.due_at,
        status: interviews.status,
        preparation: interviews.preparation,
        nextAction: job_applications.next_action,
      })
      .from(interviews)
      .innerJoin(job_applications, eq(job_applications.id, interviews.job_application_id))
      .innerJoin(cards, eq(cards.id, job_applications.card_id))
      .leftJoin(companies, eq(companies.id, job_applications.company_id))
      .where(
        and(
          eq(interviews.user_id, userId),
          isNull(job_applications.archived_at),
          isNull(cards.deleted_at),
          // A round only owes something if it carries a date. A past interview is history, not a
          // promise, and must never appear in a list of things to do.
          isNotNull(interviews.due_at),
          ...(openFilter ? [openFilter] : []),
        ),
      )
      .orderBy(interviews.due_at),

    db
      .select({
        applicationId: job_applications.id,
        cardId: job_applications.card_id,
        company: companies.name,
        position: cards.title,
        dueAt: job_applications.next_action_due,
        nextAction: job_applications.next_action,
      })
      .from(job_applications)
      .innerJoin(cards, eq(cards.id, job_applications.card_id))
      .leftJoin(companies, eq(companies.id, job_applications.company_id))
      .where(
        and(
          eq(job_applications.user_id, userId),
          isNull(job_applications.archived_at),
          isNull(cards.deleted_at),
          isNotNull(job_applications.next_action),
          isNotNull(job_applications.next_action_due),
        ),
      )
      .orderBy(job_applications.next_action_due),
  ]);

  const fromRounds: FollowUp[] = rounds.map((row) => ({
    interviewId: row.interviewId,
    applicationId: row.applicationId,
    cardId: row.cardId,
    company: row.company,
    position: row.position,
    kind: row.kind,
    dueAt: row.dueAt,
    status: row.status,
    preparation: row.preparation,
    // The application's own words win, so one list never shows two answers to one question.
    nextAction: row.nextAction ?? row.preparation,
    overdue: row.dueAt !== null && row.dueAt.getTime() < now.getTime() && row.status !== "done",
  }));

  const fromApplications: FollowUp[] = nextActions.map((row) => ({
    interviewId: null,
    applicationId: row.applicationId,
    cardId: row.cardId,
    company: row.company,
    position: row.position,
    // Named as what it is rather than borrowing the round vocabulary, so "next action" and
    // "follow-up" stay distinguishable in the UI and in the AI tool's output.
    kind: "next_action",
    dueAt: row.dueAt,
    status: "planned",
    preparation: null,
    nextAction: row.nextAction,
    overdue: row.dueAt !== null && row.dueAt.getTime() < now.getTime(),
  }));

  return [...fromRounds, ...fromApplications].sort(
    (a, b) =>
      (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
  );
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
      due_at: input.dueAt ?? null,
      status: input.status ?? "planned",
      outcome: input.outcome ?? null,
      preparation: input.preparation ?? null,
    })
    .returning();
  if (!row) throw new BoardError("invalid", "interview insert returned no row");
  return row;
}

/**
 * Correct a logged round, or tick off a follow-up (ADR-114). A follow-up is the case that matters:
 * it has a due date and no start time, and it is the row that goes stale.
 */
export async function updateInterview(
  userId: string,
  input: UpdateInterviewInput,
): Promise<typeof interviews.$inferSelect> {
  const [row] = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, input.interviewId), eq(interviews.user_id, userId)))
    .limit(1);
  if (!row) throw new BoardError("not_found", "interview not found");

  const patch: Partial<typeof interviews.$inferInsert> = {};
  // The column is NOT NULL with a default; "clear it" is not a state this row can be in.
  if (input.status !== undefined && input.status !== null) patch.status = input.status;
  if (input.outcome !== undefined) patch.outcome = input.outcome;
  if (input.preparation !== undefined) patch.preparation = input.preparation;
  if (input.feedback !== undefined) patch.feedback = input.feedback;
  if (input.rating !== undefined) patch.rating = input.rating;
  if (input.dueAt !== undefined) patch.due_at = input.dueAt;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt;

  const [updated] = await db
    .update(interviews)
    .set(patch)
    .where(and(eq(interviews.id, input.interviewId), eq(interviews.user_id, userId)))
    .returning();
  if (!updated) throw new BoardError("not_found", "interview not found");
  return updated;
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
  /**
   * Share of **sent** applications that reached a stage beyond Applied — 0…1.
   *
   * Stage-aware, not history-aware (ADR-105). The old definition counted "ever changed stage",
   * which is wrong twice: an application still sitting in Wishlist was never sent and sat in the
   * denominator, while a pipeline seeded or imported straight into Screening had no stage history
   * and so read as zero responses. The numerator now asks whether a stage past Applied was ever
   * *reached* (current stage, or any history entry), and the denominator only counts what was
   * actually sent.
   */
  responseRate: number;
  /** Applications that left Wishlist — the denominator, exposed so the label can be honest. */
  sent: number;
  /** Of those, how many reached a stage beyond Applied. */
  responded: number;
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

  // Stage-aware response rate (ADR-105). Board order is pipeline order, so "past Applied" is a
  // position in the user's own columns rather than a history heuristic: "Applied" when the
  // template provides it, otherwise the second column, the first stage past the entry point.
  const columnName = new Map(payload.columns.map((column) => [column.id, column.name]));
  const stageOrder = new Map(payload.columns.map((column, index) => [column.name, index]));
  const respondedAt = stageOrder.get("Applied") ?? 1;

  let sent = 0;
  let responded = 0;
  for (const application of applications) {
    const card = cardsById.get(application.card_id);
    if (!card) continue;
    const current = columnName.get(card.column_id);
    const currentIndex = current === undefined ? -1 : (stageOrder.get(current) ?? -1);
    // Still in the entry column: never sent, so it is not in the denominator at all. A pipeline
    // seeded or imported straight into Screening has no stage history, and everReached reads that
    // as the response it plainly is.
    if (currentIndex <= 0) continue;
    sent += 1;
    const everReached = Math.max(
      currentIndex,
      ...parseHistory(application.stage_history).map((entry) => stageOrder.get(entry.to) ?? -1),
    );
    if (everReached > respondedAt) responded += 1;
  }

  return {
    stages,
    total,
    responseRate: sent === 0 ? 0 : Math.round((responded / sent) * 100) / 100,
    sent,
    responded,
  };
}
