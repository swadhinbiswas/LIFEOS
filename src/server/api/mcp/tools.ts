import { BoardError } from "@/server/boards";
import { getDailyBrief } from "@/server/boards/brief";
import { getBoard, moveCard } from "@/server/boards";
import { getCard } from "@/server/api/v1/cards";
import { createTask } from "@/server/api/v1/cards";
import { getResume, listResumes, proposeResumeEdit } from "@/server/cv";
import { createJob, moveJobToStage, updateJob } from "@/server/career";
import { listJobApplications, type JobRow } from "@/server/career/applications";
import { createJobInput, updateJobInput } from "@/server/career/schemas";
import { search } from "@/server/search";
import { ZodError } from "zod";
import { getTimeZone } from "@/server/settings";

/**
 * MCP tools (spec §9.2, ADR-064). Each tool is a thin adapter over a service the UI already uses,
 * so an agent can never do something the web app cannot. `inputSchema` is JSON Schema, as MCP
 * requires; the dispatcher validates `arguments` against it before calling the service.
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Scope a key must hold to call it (ADR-062). */
  requiredScope: string;
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "search",
    description: "Search the user's cards and boards by title. Returns matching cards.",
    requiredScope: "read:*",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Text to match in a card title." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "create_card",
    description: "Create a task on the system Tasks board. Returns the created card.",
    requiredScope: "write:tasks",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Card title." },
        dueAt: { type: "string", description: "Optional ISO-8601 due instant." },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "move_card",
    description: "Move a card to a named column on its board (e.g. Today, Done).",
    requiredScope: "write:tasks",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string" },
        toColumnName: { type: "string", description: "Target column name on the card's board." },
      },
      required: ["cardId", "toColumnName"],
      additionalProperties: false,
    },
  },
  {
    name: "get_daily_brief",
    description: "Today's brief: overdue, due today and the top cards, in the user's timezone.",
    requiredScope: "read:*",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_resumes",
    description: "The user's CVs with their derived checklist score and share state.",
    requiredScope: "read:*",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_resume",
    description: "One CV by id as a JSON Resume document.",
    requiredScope: "read:*",
    inputSchema: {
      type: "object",
      properties: { resumeId: { type: "string", description: "CV id." } },
      required: ["resumeId"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_resume_edit",
    description:
      "Propose new summary or headline text for a CV. Returns the proposal and the current text; it never writes.",
    requiredScope: "read:*",
    inputSchema: {
      type: "object",
      properties: {
        resumeId: { type: "string" },
        section: { type: "string", enum: ["summary", "label"] },
        content: { type: "string", description: "The suggested replacement text." },
      },
      required: ["resumeId", "section", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "list_job_applications",
    description:
      "Every job application as one line each: position, company, stage, fit, progress, next action and its due date. The agent's read of the tracker.",
    requiredScope: "read:*",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", description: "Only applications in this stage." },
        company: {
          type: "string",
          description: "Only applications for this company (case-insensitive).",
        },
        includeArchived: {
          type: "boolean",
          description: "Include archived applications. Default false.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_job_application",
    description:
      "Add a job application to the pipeline. Creates the company if it is new. Returns the application and card ids.",
    requiredScope: "write:jobs",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "The position title." },
        companyName: { type: "string" },
        columnName: {
          type: "string",
          description: "Stage to file it under. Defaults to the first stage.",
        },
        url: { type: "string", description: "Link to the posting." },
        source: { type: "string", description: "Where it came from: linkedin, referral, site." },
        location: { type: "string" },
        seniority: { type: "string", enum: ["junior", "mid", "senior", "not_stated"] },
        workMode: { type: "string", enum: ["remote", "hybrid", "onsite"] },
        salaryMin: { type: "number", description: "Minor units, as stored (pence, cents)." },
        salaryMax: { type: "number", description: "Minor units, as stored (pence, cents)." },
        currency: { type: "string", description: "ISO 4217, three letters." },
        fitScore: { type: "number", description: "0-100. Drives the fit band." },
        excitement: { type: "number", description: "1-5." },
        reqId: { type: "string" },
        nextAction: { type: "string" },
        nextActionDue: { type: "string", description: "YYYY-MM-DD or an ISO-8601 instant." },
        applyBy: { type: "string", description: "YYYY-MM-DD or an ISO-8601 instant." },
        jdSnapshot: {
          type: "string",
          description: "The posting text, which will not survive the page.",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "update_job_application",
    description:
      "Change fields on one application: progress, fit, the next action, salary, ids, and the rest. Omit a field to leave it alone. Returns the updated application.",
    requiredScope: "write:jobs",
    inputSchema: {
      type: "object",
      properties: {
        applicationId: {
          type: "string",
          description: "The application id, from list_job_applications.",
        },
        progress: { type: "number", description: "0-100, how far along this is." },
        fitScore: { type: "number", description: "0-100." },
        excitement: { type: "number", description: "1-5." },
        companyName: { type: "string" },
        location: { type: "string" },
        seniority: { type: "string", enum: ["junior", "mid", "senior", "not_stated"] },
        workMode: { type: "string", enum: ["remote", "hybrid", "onsite"] },
        salaryMin: { type: "number", description: "Minor units, as stored." },
        salaryMax: { type: "number", description: "Minor units, as stored." },
        currency: { type: "string" },
        appId: { type: "string", description: "The reference number quoted to a recruiter." },
        reqId: { type: "string" },
        url: { type: "string" },
        source: { type: "string" },
        coverLetterNeeded: { type: "boolean" },
        nextAction: { type: "string" },
        nextActionDue: { type: "string", description: "YYYY-MM-DD or an ISO-8601 instant." },
        applyBy: { type: "string", description: "YYYY-MM-DD or an ISO-8601 instant." },
        archived: { type: "boolean", description: "true archives, false un-archives." },
      },
      required: ["applicationId"],
      additionalProperties: false,
    },
  },
  {
    name: "move_job_stage",
    description:
      "Move an application to a named stage (Applied, Interview, Offer, …). The stages are read from the job board; an unknown name is rejected with the real list.",
    requiredScope: "write:jobs",
    inputSchema: {
      type: "object",
      properties: {
        applicationId: { type: "string" },
        toStage: { type: "string", description: "Stage name, matched case-insensitively." },
      },
      required: ["applicationId", "toStage"],
      additionalProperties: false,
    },
  },
];

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

const text = (value: string): McpToolResult => ({ content: [{ type: "text", text: value }] });
const fail = (message: string): McpToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** Dispatch one tool call. Unknown names and bad arguments are tool errors, not RPC errors. */
export async function callTool(
  userId: string,
  name: string,
  rawArguments: unknown,
): Promise<McpToolResult> {
  const tool = MCP_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) return fail(`unknown tool: ${name}`);
  const args = asRecord(rawArguments);

  // The switch is wrapped rather than each case handling its own failures, because a *service* is
  // where "no such stage" or "not your card" is discovered, and the services signal that with
  // `BoardError` — a deliberate, already-classified outcome, not a crash. Letting one through
  // turned a recoverable mistake (naming a stage that does not exist) into a JSON-RPC failure,
  // which is the one response shape an agent cannot read a reason out of. A genuinely unexpected
  // throw still becomes a tool error, but without the message, because an unexpected error's
  // message is not written for a third party.
  try {
    return await dispatch(userId, name, args);
  } catch (error) {
    if (error instanceof BoardError) return fail(error.message);
    if (error instanceof ZodError)
      return fail(`invalid arguments: ${error.issues[0]?.message ?? ""}`);
    console.error("[mcp] tool failed", name, error);
    return fail(`${name} failed — see the server log`);
  }
}

async function dispatch(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  switch (name) {
    case "search": {
      if (typeof args.query !== "string" || args.query.trim() === "") {
        return fail("search requires a non-empty `query` string");
      }
      const results = await search(userId, args.query);
      const lines = results.cards.map(
        (card) => `card ${card.id} — ${card.title} (${card.boardName})`,
      );
      return text(lines.length > 0 ? lines.join("\n") : "no matches");
    }

    case "create_card": {
      if (typeof args.title !== "string" || args.title.trim() === "") {
        return fail("create_card requires a non-empty `title` string");
      }
      const dueAt = typeof args.dueAt === "string" ? new Date(args.dueAt) : null;
      if (dueAt && Number.isNaN(dueAt.getTime()))
        return fail("dueAt must be a valid ISO-8601 date");
      const card = await createTask(userId, { title: args.title.trim(), dueAt });
      return text(`created card ${card.id}: ${card.title}`);
    }

    case "move_card": {
      if (typeof args.cardId !== "string" || typeof args.toColumnName !== "string") {
        return fail("move_card requires `cardId` and `toColumnName` strings");
      }
      const card = await getCard(userId, args.cardId);
      if (!card) return fail(`card not found: ${args.cardId}`);
      const payload = await getBoard(userId, card.board_id);
      const target = payload.columns.find(
        (column) => column.name.toLowerCase() === (args.toColumnName as string).toLowerCase(),
      );
      if (!target) return fail(`no column named "${args.toColumnName}" on this board`);
      const last = payload.cards
        .filter((candidate) => candidate.column_id === target.id && candidate.id !== card.id)
        .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
        .at(-1);
      await moveCard(userId, {
        cardId: card.id,
        version: card.version,
        toColumnId: target.id,
        prevCardId: last?.id ?? null,
        nextCardId: null,
      });
      return text(`moved ${card.title} to ${target.name}`);
    }

    case "get_daily_brief": {
      const timeZone = await getTimeZone(userId);
      const brief = await getDailyBrief(userId, new Date(), timeZone);
      const lines = [
        `overdue: ${brief.overdue.length}, due today: ${brief.dueToday.length}, open: ${brief.openCards}`,
        ...brief.top.map((card) => `- ${card.title}`),
      ];
      return text(lines.join("\n"));
    }

    case "list_resumes": {
      const resumes = await listResumes(userId);
      return text(
        resumes.length === 0
          ? "no CVs"
          : resumes
              .map(
                (resume) =>
                  `cv ${resume.id} — ${resume.title} (checklist ${resume.atsScore ?? 0}%)`,
              )
              .join("\n"),
      );
    }

    case "get_resume": {
      if (typeof args.resumeId !== "string" || args.resumeId === "") {
        return fail("get_resume requires a `resumeId` string");
      }
      const detail = await getResume(userId, args.resumeId);
      if (!detail) return fail(`cv not found: ${args.resumeId}`);
      return text(JSON.stringify(detail.document));
    }

    case "propose_resume_edit": {
      if (
        typeof args.resumeId !== "string" ||
        (args.section !== "summary" && args.section !== "label") ||
        typeof args.content !== "string" ||
        args.content === ""
      ) {
        return fail(
          "propose_resume_edit requires `resumeId`, `section` (summary|label) and `content`",
        );
      }
      const proposal = await proposeResumeEdit(userId, {
        resumeId: args.resumeId,
        section: args.section,
        content: args.content,
      });
      if (!proposal) return fail(`cv not found: ${args.resumeId}`);
      return text(JSON.stringify(proposal));
    }

    case "list_job_applications": {
      const rows = await listJobApplications(userId, {
        includeArchived: args.includeArchived === true,
      });
      const wanted = typeof args.stage === "string" ? args.stage.toLowerCase() : null;
      const company = typeof args.company === "string" ? args.company.toLowerCase() : null;
      const matching = rows
        .filter((row) => (wanted ? row.stage.toLowerCase() === wanted : true))
        .filter((row) => (company ? (row.company ?? "").toLowerCase() === company : true));
      if (matching.length === 0) {
        // An empty list is indistinguishable from a filter that matched nothing. Say which.
        return text(
          rows.length === 0
            ? "no job applications"
            : `no applications match that filter (${rows.length} exist)`,
        );
      }
      return text(matching.map(jobLine).join("\n"));
    }

    case "create_job_application": {
      if (typeof args.title !== "string" || args.title.trim() === "") {
        return fail("create_job_application requires a non-empty `title` string");
      }
      // Only the fields the caller actually sent are forwarded. Spreading a defaulted object would
      // overwrite every nullable column with null on each create, which is a silent data loss for
      // any field the agent simply did not know about.
      const input = pick(args, [
        "companyName",
        "columnName",
        "url",
        "source",
        "location",
        "seniority",
        "workMode",
        "salaryMin",
        "salaryMax",
        "currency",
        "fitScore",
        "excitement",
        "reqId",
        "nextAction",
        "jdSnapshot",
      ]) as Record<string, unknown>;
      const dates = dateFields(args, ["nextActionDue", "applyBy"]);
      const result = await createJob(
        userId,
        createJobInput.parse({ title: args.title.trim(), ...input, ...dates }),
      );
      return text(
        `created application ${result.application.id} (card ${result.card.id}): ${result.card.title}`,
      );
    }

    case "update_job_application": {
      if (typeof args.applicationId !== "string" || args.applicationId === "") {
        return fail("update_job_application requires an `applicationId` string");
      }
      const input = pick(args, [
        "progress",
        "fitScore",
        "excitement",
        "companyName",
        "location",
        "seniority",
        "workMode",
        "salaryMin",
        "salaryMax",
        "currency",
        "appId",
        "reqId",
        "url",
        "source",
        "coverLetterNeeded",
        "nextAction",
        "archived",
      ]) as Record<string, unknown>;
      const dates = dateFields(args, ["nextActionDue", "applyBy"]);
      // A patch with no fields is a read, and `updateJob` says so rather than throwing — but saying
      // "nothing to change" is more useful than silently succeeding, so the agent finds out here.
      if (Object.keys(input).length === 0 && Object.keys(dates).length === 0) {
        return fail("update_job_application needs at least one field to change");
      }
      const row = await updateJob(
        userId,
        updateJobInput.parse({ applicationId: args.applicationId, ...input, ...dates }),
      );
      // `updateJob` returns the application row, and the position lives on the card it hangs off —
      // so this reports the fields it actually wrote rather than a name it would have to re-read.
      return text(
        `updated application ${row.id} — progress ${row.progress ?? "—"}, fit score ${row.fit_score ?? "—"}`,
      );
    }

    case "move_job_stage": {
      if (typeof args.applicationId !== "string" || typeof args.toStage !== "string") {
        return fail("move_job_stage requires `applicationId` and `toStage` strings");
      }
      const result = await moveJobToStage(userId, {
        applicationId: args.applicationId,
        toStage: args.toStage,
      });
      return text(`application ${args.applicationId} is now in ${result.stage}`);
    }

    default:
      return fail(`unknown tool: ${name}`);
  }
}

/** Keep only the keys the caller actually sent, so a partial patch stays partial. */
function pick(args: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (args[key] !== undefined) out[key] = args[key];
  return out;
}

/**
 * Coerce the date-ish arguments, dropping the ones that are not parseable.
 *
 * MCP arguments arrive as strings, because that is all JSON Schema's `string` gives us, and Zod's
 * `z.coerce.date()` turns "next tuesday" into an Invalid Date rather than an error. A date the
 * agent guessed at should not be written as a silently wrong instant, so an unparseable one is
 * dropped and the field is simply left alone.
 */
function dateFields(args: Record<string, unknown>, keys: string[]): Record<string, Date> {
  const out: Record<string, Date> = {};
  for (const key of keys) {
    if (typeof args[key] !== "string") continue;
    const at = new Date(args[key] as string);
    if (!Number.isNaN(at.getTime())) out[key] = at;
  }
  return out;
}

/** One application, one line: the fields an agent acts on, and nothing it does not. */
function jobLine(row: JobRow): string {
  const money =
    row.salaryMin !== null || row.salaryMax !== null
      ? ` ${row.currency ?? ""}${
          row.salaryMin !== null && row.salaryMax !== null
            ? `${row.salaryMin}-${row.salaryMax}`
            : (row.salaryMin ?? row.salaryMax)
        }`.trim()
      : "";
  const due = row.nextActionDue ? ` (due ${row.nextActionDue.toISOString().slice(0, 10)})` : "";
  const progress = row.progress === null ? "" : ` progress ${row.progress}%`;
  const next = row.nextAction ? ` next: ${row.nextAction}${due}` : "";
  const fit = row.fit ? ` fit ${row.fit}` : "";
  return `${row.applicationId} — ${row.position} @ ${row.company ?? "?"} [${row.stage}]${fit}${progress}${money}${next}`;
}
