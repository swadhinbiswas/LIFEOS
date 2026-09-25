import { tool, type Tool } from "ai";
import { z } from "zod";

import { getCard, createTask } from "@/server/api/v1/cards";
import {
  createBoard,
  deleteCard,
  getBoard,
  listBoards,
  moveCard,
  updateCard,
} from "@/server/boards";
import { getDailyBrief } from "@/server/boards/brief";
import {
  ensureJobBoard,
  getFunnel,
  getJobDetail,
  getJobMeta,
  createJob,
  moveJobStage,
  addInterview,
} from "@/server/career";
import { addTransaction } from "@/server/finance";
import { getResume, listResumes, proposeResumeEdit } from "@/server/cv";
import { startSession } from "@/server/focus";
import { listGoals, setKeyResultValue } from "@/server/goals";
import { listHabits, setHabitLog } from "@/server/habits";
import { createNote, dailyNote, getNote, updateNote } from "@/server/notes";
import { search } from "@/server/search";
import { getTimeZone } from "@/server/settings";

import { findToolSpec } from "./catalog";

/**
 * The AI tool layer (spec §8, ADR-076). Every tool is a thin adapter over the service the UI, REST
 * and MCP already use, so the model can never do something the web app cannot. The `inputSchema`
 * is Zod (AI SDK v7), validated by the SDK before `execute` runs.
 *
 * This module is server-only and builds tools for one authenticated user; the caller
 * (`agent.ts`) pairs it with the approval policy and never exposes a write tool without it.
 */

const optionalTrimmed = z.string().trim().max(2_000).optional();

const summarizeCard = (card: {
  id: string;
  title: string;
  column_id: string;
  due_at?: Date | string | null;
  priority: string | null;
}) => ({
  id: card.id,
  title: card.title,
  columnId: card.column_id,
  dueAt: card.due_at ? new Date(card.due_at).toISOString() : null,
  priority: card.priority,
});

/** Column lookup by case-insensitive name, mirroring the MCP `move_card` tool. */
async function findColumn(userId: string, boardId: string, name: string) {
  const payload = await getBoard(userId, boardId);
  return {
    payload,
    column: payload.columns.find((c) => c.name.toLowerCase() === name.trim().toLowerCase()),
  };
}

async function moveCardToColumn(userId: string, cardId: string, toColumnName: string) {
  const card = await getCard(userId, cardId);
  if (!card) throw new Error(`card not found: ${cardId}`);
  const { payload, column } = await findColumn(userId, card.board_id, toColumnName);
  if (!column) throw new Error(`no column named "${toColumnName}" on this board`);
  const previous = payload.cards
    .filter((c) => c.column_id === column.id && c.id !== card.id)
    .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
    .at(-1);
  const moved = await moveCard(userId, {
    cardId: card.id,
    version: card.version,
    toColumnId: column.id,
    prevCardId: previous?.id ?? null,
    nextCardId: null,
  });
  return { moved, column };
}

export function buildAiTools(userId: string): Record<string, Tool> {
  const spec = (name: string) => {
    const found = findToolSpec(name);
    if (!found) throw new Error(`unknown tool: ${name}`);
    return found;
  };
  const make = <S extends z.ZodType>(
    name: string,
    inputSchema: S,
    execute: (input: z.infer<S>) => Promise<unknown>,
  ) => tool({ description: spec(name).description, inputSchema, execute });

  return {
    search: make(
      "search",
      z.object({ query: z.string().trim().min(1).max(200) }),
      async ({ query }) => {
        const results = await search(userId, query);
        return {
          cards: results.cards.map((c) => ({ id: c.id, title: c.title, board: c.boardName })),
        };
      },
    ),

    get_daily_brief: make("get_daily_brief", z.object({}), async () => {
      const brief = await getDailyBrief(userId, new Date(), await getTimeZone(userId));
      return {
        overdue: brief.overdue.length,
        dueToday: brief.dueToday.length,
        open: brief.openCards,
        top: brief.top.map(summarizeCard),
      };
    }),

    list_boards: make("list_boards", z.object({}), async () => {
      const boards = await listBoards(userId);
      return { boards: boards.map((b) => ({ id: b.id, name: b.name, system: b.is_system })) };
    }),

    get_board: make("get_board", z.object({ boardId: z.string().min(1) }), async ({ boardId }) => {
      const payload = await getBoard(userId, boardId);
      return {
        id: payload.board.id,
        name: payload.board.name,
        columns: payload.columns.map((c) => ({ id: c.id, name: c.name, done: c.is_done })),
        cards: payload.cards.map(summarizeCard),
      };
    }),

    list_cards: make(
      "list_cards",
      z.object({
        boardId: z.string().min(1).optional(),
        columnName: z.string().min(1).optional(),
        openOnly: z.boolean().optional(),
      }),
      async ({ boardId, columnName, openOnly }) => {
        const boards = boardId ? [{ id: boardId }] : await listBoards(userId);
        const rows: Array<Record<string, unknown>> = [];
        for (const board of boards.slice(0, 20)) {
          const payload = await getBoard(userId, board.id);
          for (const column of payload.columns) {
            if (columnName && column.name.toLowerCase() !== columnName.toLowerCase()) continue;
            for (const card of payload.cards.filter((c) => c.column_id === column.id)) {
              if (openOnly && card.completed_at) continue;
              rows.push({ ...summarizeCard(card), board: payload.board.name, column: column.name });
            }
          }
          if (rows.length > 200) break;
        }
        return { cards: rows.slice(0, 100) };
      },
    ),

    get_card: make("get_card", z.object({ cardId: z.string().min(1) }), async ({ cardId }) => {
      const card = await getCard(userId, cardId);
      if (!card) throw new Error(`card not found: ${cardId}`);
      return card;
    }),

    list_jobs: make("list_jobs", z.object({}), async () => {
      const board = await ensureJobBoard(userId);
      const [payload, meta] = await Promise.all([getBoard(userId, board.id), getJobMeta(userId)]);
      const columns = new Map(payload.columns.map((c) => [c.id, c.name]));
      return {
        jobs: payload.cards.map((card) => ({
          cardId: card.id,
          title: card.title,
          stage: columns.get(card.column_id) ?? "",
          company: meta[card.id]?.map((chip) => chip.label).join(", ") ?? "",
        })),
      };
    }),

    get_pipeline_stats: make("get_pipeline_stats", z.object({}), async () => {
      const funnel = await getFunnel(userId);
      return funnel;
    }),

    list_habits: make("list_habits", z.object({}), async () => {
      const habits = await listHabits(userId);
      return {
        habits: habits.map((row) => ({
          id: row.habit.id,
          name: row.habit.name,
          kind: row.habit.kind,
          today: row.value,
          streak: row.streak,
          target: row.habit.target,
          unit: row.habit.unit,
        })),
      };
    }),

    list_goals: make("list_goals", z.object({}), async () => {
      const goals = await listGoals(userId);
      return {
        goals: goals.map((goal) => ({
          id: goal.goal.id,
          title: goal.goal.title,
          status: goal.goal.status,
          progress: goal.progress,
          keyResults: goal.keyResults.map((kr) => ({
            id: kr.row.id,
            title: kr.row.title,
            current: kr.row.current,
            target: kr.row.target,
            kind: kr.row.kind,
          })),
        })),
      };
    }),

    get_note: make("get_note", z.object({ noteId: z.string().min(1) }), async ({ noteId }) => {
      const detail = await getNote(userId, noteId);
      if (!detail) throw new Error(`note not found: ${noteId}`);
      return { id: detail.note.id, title: detail.note.title, body: detail.note.body };
    }),

    list_resumes: make("list_resumes", z.object({}), async () => {
      const resumes = await listResumes(userId);
      return {
        resumes: resumes.map((resume) => ({
          id: resume.id,
          title: resume.title,
          checklist: resume.atsScore,
          shared: resume.shareEnabled,
        })),
      };
    }),

    get_resume: make(
      "get_resume",
      z.object({ resumeId: z.string().min(1) }),
      async ({ resumeId }) => {
        const detail = await getResume(userId, resumeId);
        if (!detail) throw new Error(`cv not found: ${resumeId}`);
        return { id: detail.summary.id, title: detail.summary.title, document: detail.document };
      },
    ),

    propose_resume_edit: make(
      "propose_resume_edit",
      z.object({
        resumeId: z.string().min(1),
        section: z.enum(["summary", "label"]),
        content: z.string().min(1).max(4_000),
      }),
      async ({ resumeId, section, content }) => {
        const proposal = await proposeResumeEdit(userId, { resumeId, section, content });
        if (!proposal) throw new Error(`cv not found: ${resumeId}`);
        return proposal;
      },
    ),

    // --- writes: approval-gated (ADR-076) -----------------------------------
    create_card: make(
      "create_card",
      z.object({
        title: z.string().trim().min(1).max(300),
        dueAt: z.string().datetime().optional(),
        priority: z.enum(["p0", "p1", "p2", "p3"]).optional(),
      }),
      async ({ title, dueAt, priority }) => {
        const card = await createTask(userId, {
          title,
          dueAt: dueAt ? new Date(dueAt) : null,
          priority: priority ?? null,
        });
        return summarizeCard(card);
      },
    ),

    update_card: make(
      "update_card",
      z.object({
        cardId: z.string().min(1),
        title: z.string().trim().min(1).max(300).optional(),
        description: z.string().max(20_000).nullable().optional(),
        priority: z.enum(["p0", "p1", "p2", "p3"]).nullable().optional(),
        estimateMin: z.number().int().min(0).max(100_000).nullable().optional(),
        dueAt: z.string().datetime().nullable().optional(),
      }),
      async ({ cardId, title, description, priority, estimateMin, dueAt }) => {
        const card = await getCard(userId, cardId);
        if (!card) throw new Error(`card not found: ${cardId}`);
        const updated = await updateCard(userId, {
          cardId,
          version: card.version,
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(estimateMin !== undefined ? { estimateMin } : {}),
          ...(dueAt !== undefined ? { dueAt: dueAt === null ? null : new Date(dueAt) } : {}),
        });
        return summarizeCard(updated);
      },
    ),

    move_card: make(
      "move_card",
      z.object({ cardId: z.string().min(1), toColumnName: z.string().min(1) }),
      async ({ cardId, toColumnName }) => {
        const { moved, column } = await moveCardToColumn(userId, cardId, toColumnName);
        return { id: moved.id, title: moved.title, column: column.name };
      },
    ),

    complete_card: make(
      "complete_card",
      z.object({ cardId: z.string().min(1) }),
      async ({ cardId }) => {
        const card = await getCard(userId, cardId);
        if (!card) throw new Error(`card not found: ${cardId}`);
        const payload = await getBoard(userId, card.board_id);
        const done = payload.columns.find((c) => c.is_done) ?? payload.columns.at(-1);
        if (!done) throw new Error("this board has no done column");
        const { moved } = await moveCardToColumn(userId, cardId, done.name);
        return { id: moved.id, title: moved.title, column: done.name };
      },
    ),

    create_note: make(
      "create_note",
      z.object({ title: z.string().trim().max(300).optional(), body: z.string().max(50_000) }),
      async ({ title, body }) => {
        const note = await createNote(userId, { title: title ?? "", body });
        return { id: note.id, title: note.title };
      },
    ),

    append_to_daily_note: make(
      "append_to_daily_note",
      z.object({ markdown: z.string().min(1).max(20_000) }),
      async ({ markdown }) => {
        const note = await dailyNote(userId);
        const body = note.body ? `${note.body}\n\n${markdown}` : markdown;
        await updateNote(userId, { noteId: note.id, body });
        return { id: note.id, title: note.title };
      },
    ),

    run_weekly_review: make(
      "run_weekly_review",
      z.object({ body: z.string().min(1).max(50_000) }),
      async ({ body }) => {
        const today = new Date().toISOString().slice(0, 10);
        const note = await createNote(userId, {
          title: `Weekly review — ${today}`,
          body,
          kind: "note",
        });
        return { id: note.id, title: note.title };
      },
    ),

    log_habit: make(
      "log_habit",
      z.object({
        habitId: z.string().min(1),
        value: z.number().min(0).max(1_000_000),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/u)
          .optional(),
      }),
      async ({ habitId, value, date }) => {
        await setHabitLog(userId, { habitId, value, date });
        return { habitId, value, date: date ?? "today" };
      },
    ),

    update_goal_progress: make(
      "update_goal_progress",
      z.object({ keyResultId: z.string().min(1), current: z.number().min(0).max(1_000_000) }),
      async ({ keyResultId, current }) => {
        const row = await setKeyResultValue(userId, { keyResultId, current });
        return { keyResultId: row.id, current: row.current };
      },
    ),

    add_job_application: make(
      "add_job_application",
      z.object({
        title: z.string().trim().min(1).max(300),
        company: optionalTrimmed,
        workMode: z.enum(["remote", "hybrid", "onsite"]).optional(),
        url: z.string().url().optional(),
      }),
      async ({ title, company, workMode, url }) => {
        const { card, application } = await createJob(userId, {
          title,
          companyName: company ?? null,
          workMode: workMode ?? null,
          url: url ?? null,
        });
        return { cardId: card.id, applicationId: application.id, title: card.title };
      },
    ),

    update_job_stage: make(
      "update_job_stage",
      z.object({ cardId: z.string().min(1), stage: z.string().min(1) }),
      async ({ cardId, stage }) => {
        const detail = await getJobDetail(userId, cardId);
        if (!detail) throw new Error(`job not found: ${cardId}`);
        const board = await ensureJobBoard(userId);
        const payload = await getBoard(userId, board.id);
        const target = payload.columns.find((c) => c.name.toLowerCase() === stage.toLowerCase());
        if (!target) throw new Error(`no stage named "${stage}"`);
        const previous = payload.cards
          .filter((c) => c.column_id === target.id && c.id !== cardId)
          .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
          .at(-1);
        await moveJobStage(userId, {
          applicationId: detail.application.id,
          version: detail.card.version,
          toColumnId: target.id,
          prevCardId: previous?.id ?? null,
          nextCardId: null,
        });
        return { cardId, stage: target.name };
      },
    ),

    log_interview: make(
      "log_interview",
      z.object({
        cardId: z.string().min(1),
        kind: z.enum(["screen", "tech", "system_design", "behavioral", "final"]),
        startsAt: z.string().datetime().optional(),
        feedback: optionalTrimmed,
      }),
      async ({ cardId, kind, startsAt, feedback }) => {
        const detail = await getJobDetail(userId, cardId);
        if (!detail) throw new Error(`job not found: ${cardId}`);
        const row = await addInterview(userId, {
          applicationId: detail.application.id,
          kind,
          startsAt: startsAt ? new Date(startsAt) : null,
          feedback: feedback ?? null,
        });
        return { id: row.id, kind: row.kind };
      },
    ),

    start_focus_session: make(
      "start_focus_session",
      z.object({ plannedMin: z.number().int().min(1).max(600).nullable().optional() }),
      async ({ plannedMin }) => {
        const session = await startSession(userId, { plannedMin: plannedMin ?? null });
        return { id: session.id, plannedMin: session.planned_min ?? null };
      },
    ),

    add_transaction: make(
      "add_transaction",
      z.object({
        accountId: z.string().min(1),
        amountMinor: z.number().int(),
        category: optionalTrimmed,
        merchant: optionalTrimmed,
      }),
      async ({ accountId, amountMinor, category, merchant }) => {
        const row = await addTransaction(userId, {
          accountId,
          amountMinor,
          category: category ?? null,
          merchant: merchant ?? null,
        });
        return { id: row.id, amountMinor: row.amount_minor, currency: row.currency };
      },
    ),

    create_board_from_template: make(
      "create_board_from_template",
      z.object({
        name: z.string().trim().min(1).max(120),
        template: z.string().trim().min(1).max(60).optional(),
      }),
      async ({ name, template }) => {
        const board = await createBoard(userId, { name, template });
        return { id: board.id, name: board.name };
      },
    ),

    delete_card: make(
      "delete_card",
      z.object({ cardId: z.string().min(1) }),
      async ({ cardId }) => {
        await deleteCard(userId, cardId);
        return { cardId, trashed: true };
      },
    ),
  };
}
