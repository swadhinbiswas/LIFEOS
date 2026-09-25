import { getDailyBrief } from "@/server/boards/brief";
import { getBoard, moveCard } from "@/server/boards";
import { getCard } from "@/server/api/v1/cards";
import { createTask } from "@/server/api/v1/cards";
import { getResume, listResumes, proposeResumeEdit } from "@/server/cv";
import { search } from "@/server/search";
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

    default:
      return fail(`unknown tool: ${name}`);
  }
}
