import { MCP_TOOLS } from "@/server/api/mcp/tools";

import { DOCS, type DocEntry, readDoc } from "./index";

/**
 * `/llms.txt` and `/llms-full.txt` (spec §9.2): a machine-readable map of the product for AI agents.
 * Both are composed from the live sources — the docs registry and the MCP tool catalogue — so they
 * cannot drift from what the app actually serves.
 */

/** Documents worth an agent's context, in reading order. */
const LLMS_SLUGS = [
  "readme",
  "architecture",
  "api",
  "theming",
  "contributing",
  "ingest",
  "security",
  "self-hosting",
];

const entryBySlug = (slug: string): DocEntry | undefined => DOCS.find((doc) => doc.slug === slug);

const header = ["# LifeOS", ""].join("\n");

const intro = [
  "> LifeOS is a free, open, AI-connected personal operating system: Kanban/tasks, career and CV,",
  "> habits, notes, goals and finance in a keyboard-first, TUI-skinned web app. Everything the UI",
  "> does is also available over a REST API and an MCP server, through the same service layer and",
  "> the same Zod schemas.",
  "",
].join("\n");

const apiSection = (origin: string): string =>
  [
    "## API",
    "",
    `- OpenAPI 3.1 description: ${origin}/api/v1/openapi.json`,
    `- Interactive reference: ${origin}/docs/api`,
    `- Auth: \`Authorization: Bearer lifeos_live_…\` (personal keys, created in Settings → Integrations)`,
    `- Fast capture: \`POST ${origin}/api/v1/ingest\` with \`{ type, data, source }\``,
    "- Errors are always `{ error: { code, message, details, request_id } }`",
    "- Pagination is cursor-based: `?limit=&cursor=`; filtering and sparse `?fields=` are supported",
    "",
  ].join("\n");

const mcpSection = (origin: string): string =>
  [
    "## MCP server",
    "",
    `- Endpoint: ${origin}/api/mcp (Streamable HTTP, Bearer API key)`,
    "- Tools:",
    ...MCP_TOOLS.map((tool) => `  - \`${tool.name}\`: ${tool.description}`),
    "",
  ].join("\n");

/** The short index: what LifeOS is, where the docs are, and how to talk to it. */
export async function buildLlmsTxt(origin: string): Promise<string> {
  const lines: string[] = [header, "", intro, "## Docs", ""];
  for (const slug of LLMS_SLUGS) {
    const entry = entryBySlug(slug);
    if (!entry) continue;
    lines.push(`- [${entry.title}](${origin}/docs/${entry.slug}): ${entry.path}`);
  }
  lines.push("", apiSection(origin), mcpSection(origin));
  return lines.join("\n");
}

/** The full context: every key document inline, plus the API and MCP summaries. */
export async function buildLlmsFullTxt(origin: string): Promise<string> {
  const parts: string[] = [header, "", intro];
  for (const slug of LLMS_SLUGS) {
    const entry = entryBySlug(slug);
    if (!entry) continue;
    const text = await readDoc(entry);
    if (!text) continue;
    parts.push(`---\n\n<!-- source: ${entry.path} -->\n`, text);
  }
  parts.push("---\n", apiSection(origin), mcpSection(origin));
  return parts.join("\n");
}
