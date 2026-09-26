import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/server/db";
import { board_columns, cards, companies, job_applications } from "@/server/db/schema";

import { fitBandFor } from "./schemas";

/**
 * One row per application, joined to the card it hangs off and the column that holds it.
 *
 * This is the read model the career surfaces are built on. It exists because the fields were already
 * there and scattered: `getJobMeta` could return chips for a card, `readJob` could return one
 * application, and there was no way to ask "every application, with its stage and its fit" — which
 * is what a tracker table, a funnel by stage and a follow-up queue all need. Writing the join once
 * here means those three views cannot disagree about a field.
 *
 * `fit` is derived from `fit_score` through `fitBandFor` rather than stored (ADR-114): a stored
 * band would be a second copy of a number that can change, and the two would drift.
 */
/** The band `fitBandFor` returns, named once here so callers do not restate the union. */
export type FitBand = ReturnType<typeof fitBandFor>;

export interface JobRow {
  /** The application's own id. Stable across a stage move; the card is what moves. */
  applicationId: string;
  /** The card the pipeline board shows. `/career/jobs/[id]` is keyed on this. */
  cardId: string;
  position: string;
  company: string | null;
  companyId: string | null;
  /** Column name — "Applied", "Interview", "Offer" — so a caller can group or filter by stage. */
  stage: string;
  stageId: string;
  seniority: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  fitScore: number | null;
  fit: FitBand | null;
  excitement: number | null;
  location: string | null;
  workMode: string | null;
  visaStatus: string | null;
  reqId: string | null;
  appId: string | null;
  progress: number | null;
  coverLetterNeeded: boolean | null;
  url: string | null;
  applyBy: Date | null;
  applyEmail: string | null;
  dateApplied: Date | null;
  nextAction: string | null;
  nextActionDue: Date | null;
  /** Whole history, so a view can show time-in-stage without a second query. */
  stageHistory: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Every application for a user, newest activity first.
 *
 * Archived applications are excluded rather than filtered by the caller: a tracker that lists
 * withdrawn roles next to live ones is noise, and `includeArchived` makes forgetting to filter a
 * decision nobody should have to make twice.
 */
export async function listJobApplications(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<JobRow[]> {
  const rows = await db
    .select({
      applicationId: job_applications.id,
      cardId: job_applications.card_id,
      position: cards.title,
      company: companies.name,
      companyId: job_applications.company_id,
      stage: board_columns.name,
      stageId: cards.column_id,
      seniority: job_applications.seniority,
      salaryMin: job_applications.salary_min,
      salaryMax: job_applications.salary_max,
      currency: job_applications.currency,
      fitScore: job_applications.fit_score,
      excitement: job_applications.excitement,
      location: job_applications.location,
      workMode: job_applications.work_mode,
      visaStatus: job_applications.visa_status,
      reqId: job_applications.req_id,
      appId: job_applications.app_id,
      progress: job_applications.progress,
      coverLetterNeeded: job_applications.cover_letter_needed,
      url: job_applications.url,
      applyBy: job_applications.apply_by,
      applyEmail: job_applications.apply_email,
      dateApplied: job_applications.date_applied,
      nextAction: job_applications.next_action,
      nextActionDue: job_applications.next_action_due,
      stageHistory: job_applications.stage_history,
      createdAt: cards.created_at,
      updatedAt: cards.updated_at,
      archivedAt: job_applications.archived_at,
    })
    .from(job_applications)
    // `card_id` is the anchor: the pipeline board and every link to a job are keyed on the card, so
    // a row without one cannot be opened, filtered into a stage, or dragged. Inner join, on purpose.
    .innerJoin(cards, eq(job_applications.card_id, cards.id))
    .innerJoin(board_columns, eq(cards.column_id, board_columns.id))
    .leftJoin(companies, eq(companies.id, job_applications.company_id))
    .where(
      options.includeArchived
        ? eq(job_applications.user_id, userId)
        : and(eq(job_applications.user_id, userId), isNull(job_applications.archived_at)),
    )
    .orderBy(desc(cards.updated_at), asc(cards.position));

  return rows.map((row) => ({
    applicationId: row.applicationId,
    cardId: row.cardId,
    position: row.position,
    company: row.company,
    companyId: row.companyId,
    stage: row.stage,
    stageId: row.stageId,
    seniority: row.seniority,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    currency: row.currency,
    fitScore: row.fitScore,
    fit: fitBandFor(row.fitScore),
    excitement: row.excitement,
    location: row.location,
    workMode: row.workMode,
    visaStatus: row.visaStatus,
    reqId: row.reqId,
    appId: row.appId,
    progress: row.progress,
    coverLetterNeeded: row.coverLetterNeeded,
    url: row.url,
    applyBy: row.applyBy,
    applyEmail: row.applyEmail,
    dateApplied: row.dateApplied,
    nextAction: row.nextAction,
    nextActionDue: row.nextActionDue,
    stageHistory: row.stageHistory,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  }));
}

/** The stage names in pipeline order, for a filter control that lists them as they actually are. */
/**
 * The columns of one board, in order — the stages of the job pipeline.
 *
 * The board id is a parameter rather than looked up here because a user owns several boards, and
 * their Tasks board has columns called "Inbox", "Today" and "Done". Returning every column the user
 * owns offered a job a move to "Done" that put its card on the wrong board, and it did so silently
 * enough to look like a working dropdown.
 */
export async function listJobStages(
  userId: string,
  boardId: string,
): Promise<Array<{ id: string; name: string }>> {
  return db
    .select({ id: board_columns.id, name: board_columns.name })
    .from(board_columns)
    .where(and(eq(board_columns.board_id, boardId), eq(board_columns.user_id, userId)))
    .orderBy(asc(board_columns.position));
}
