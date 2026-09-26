import { getCard } from "@/server/api/v1/cards";
import { getDailyBrief } from "@/server/boards/brief";
import { listJobApplications } from "@/server/career/applications";
import { getNote } from "@/server/notes";
import { getTimeZone } from "@/server/settings";

/**
 * MCP resources and prompts (spec §9.2, ADR-071). Resources are read-only views an agent can pull
 * (`lifeos://…`); prompts are reusable instructions the client can offer the user. Both read through
 * the same services the app and REST use, so an agent can see nothing the user cannot.
 */

export interface McpResource {
  uri: string;
  name: string;
  mimeType: string;
}

export const MCP_RESOURCES: McpResource[] = [
  { uri: "lifeos://brief", name: "Today's brief", mimeType: "text/plain" },
];

export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  mimeType: string;
}

export const MCP_RESOURCE_TEMPLATES: McpResourceTemplate[] = [
  { uriTemplate: "lifeos://cards/{id}", name: "A card", mimeType: "application/json" },
  { uriTemplate: "lifeos://notes/{id}", name: "A note", mimeType: "text/markdown" },
  { uriTemplate: "lifeos://jobs", name: "Every job application", mimeType: "application/json" },
  { uriTemplate: "lifeos://jobs/{id}", name: "One job application", mimeType: "application/json" },
];

export interface McpContent {
  uri: string;
  mimeType: string;
  text: string;
}

/** Read one resource by URI. Returns a list of contents, or an error string for a bad URI. */
export async function readResource(
  userId: string,
  uri: string,
): Promise<{ contents: McpContent[] } | { error: string }> {
  if (uri === "lifeos://brief") {
    const timeZone = await getTimeZone(userId);
    const brief = await getDailyBrief(userId, new Date(), timeZone);
    const text = [
      `overdue: ${brief.overdue.length}, due today: ${brief.dueToday.length}, open: ${brief.openCards}`,
      ...brief.top.map((card) => `- ${card.title}`),
    ].join("\n");
    return { contents: [{ uri, mimeType: "text/plain", text }] };
  }

  if (uri.startsWith("lifeos://cards/")) {
    const id = uri.slice("lifeos://cards/".length);
    const card = await getCard(userId, id);
    if (!card) return { error: `card not found: ${id}` };
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(card) }] };
  }

  if (uri.startsWith("lifeos://notes/")) {
    const id = uri.slice("lifeos://notes/".length);
    const detail = await getNote(userId, id).catch(() => null);
    if (!detail) return { error: `note not found: ${id}` };
    return {
      contents: [
        { uri, mimeType: "text/markdown", text: `# ${detail.note.title}\n\n${detail.note.body}` },
      ],
    };
  }

  if (uri === "lifeos://jobs" || uri.startsWith("lifeos://jobs/")) {
    const rows = await listJobApplications(userId);
    // The whole set as one JSON document rather than a per-application resource, because an agent
    // asking "what is in the pipeline" wants the pipeline, not 40 round trips it has to reassemble.
    if (uri === "lifeos://jobs") {
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(rows, null, 2) }],
      };
    }
    const id = uri.slice("lifeos://jobs/".length);
    const row = rows.find((candidate) => candidate.applicationId === id || candidate.cardId === id);
    if (!row) return { error: `job application not found: ${id}` };
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(row, null, 2) }],
    };
  }

  return { error: `unknown resource: ${uri}` };
}

export interface McpPrompt {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required: boolean }>;
}

export const MCP_PROMPTS: McpPrompt[] = [
  {
    name: "daily-plan",
    description: "Plan the day with LifeOS: read the brief, then suggest the top three tasks.",
    arguments: [],
  },
  {
    name: "job-follow-up",
    description: "Find job applications that have gone quiet and draft follow-ups.",
    arguments: [
      {
        name: "minDays",
        description: "Days without a stage change to count as quiet.",
        required: false,
      },
    ],
  },
  {
    name: "weekly-review",
    description: "Run a weekly review: what moved, what stalled, and what is next.",
    arguments: [],
  },
];

export interface McpPromptMessage {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
}

export function getPrompt(
  name: string,
  args: Record<string, unknown>,
): { description: string; messages: McpPromptMessage[] } | null {
  const prompt = MCP_PROMPTS.find((candidate) => candidate.name === name);
  if (!prompt) return null;

  const text =
    name === "daily-plan"
      ? "Call get_daily_brief and the lifeos://brief resource, then propose the three most valuable tasks for today, noting anything overdue."
      : name === "job-follow-up"
        ? `List my job applications with no stage change for ${String(args.minDays ?? 7)} days, and draft a short, specific follow-up message for each.`
        : "Summarise the week from my cards and notes: what moved, what stalled, and what to plan next. Be concise and concrete.";

  return {
    description: prompt.description,
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}
