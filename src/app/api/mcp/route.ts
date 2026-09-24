import { callTool, MCP_TOOLS } from "@/server/api/mcp/tools";
import { apiContext, scopeAllows } from "@/server/api/v1/context";
import { withinRateLimit } from "@/server/api/v1/support";

/**
 * MCP server (spec §9.2, ADR-064) over Streamable HTTP with a JSON response — a stateless,
 * single-endpoint server: every JSON-RPC message is one POST, the reply is `application/json`, and
 * no `Mcp-Session-Id` is issued (so a client needs no session bookkeeping). Auth is a Bearer API
 * key (ADR-062); the tools are thin adapters over the same services the UI calls.
 */

const JSONRPC = "2.0";
const SERVER_INFO = { name: "LifeOS", version: "0.0.1" };
const SUPPORTED_VERSIONS = ["2026-07-28", "2025-11-25", "2025-06-18"];
const LATEST_VERSION = SUPPORTED_VERSIONS[0] as string;

const rpcResult = (id: unknown, result: unknown): Response =>
  Response.json({ jsonrpc: JSONRPC, id: id ?? null, result });

const rpcError = (id: unknown, code: number, message: string, data?: unknown): Response =>
  Response.json({
    jsonrpc: JSONRPC,
    id: id ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  });

/** DNS-rebinding guard: a present Origin must match the request host (spec 2026-07-28). */
function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const negotiate = (requested: unknown): string =>
  typeof requested === "string" && SUPPORTED_VERSIONS.includes(requested)
    ? requested
    : LATEST_VERSION;

export async function POST(request: Request): Promise<Response> {
  if (!originAllowed(request)) {
    return Response.json({ error: "forbidden origin" }, { status: 403 });
  }

  const context = await apiContext(request);
  if (!context) {
    return Response.json({ error: "a valid API key is required" }, { status: 401 });
  }
  if (!(await withinRateLimit(context.actor))) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return rpcError(null, -32700, "parse error");
  }
  if (Array.isArray(message)) {
    // 2026-07-28 rejects JSON-RPC batches; one message per POST.
    return rpcError(null, -32600, "batches are not supported; send one message per request");
  }

  const { id, method, params } = (message ?? {}) as {
    id?: unknown;
    method?: unknown;
    params?: unknown;
  };
  const isNotification = id === undefined || id === null;
  const args = (params ?? {}) as { name?: unknown; arguments?: unknown; protocolVersion?: unknown };

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: negotiate(args.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return new Response(null, { status: 202 });

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, {
        tools: MCP_TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });

    case "tools/call": {
      if (typeof args.name !== "string") {
        return rpcError(id, -32602, "tools/call requires params.name");
      }
      const tool = MCP_TOOLS.find((candidate) => candidate.name === args.name);
      if (!tool) return rpcError(id, -32602, `unknown tool: ${args.name}`);
      if (!scopeAllows(context.scopes, tool.requiredScope)) {
        return rpcResult(id, {
          content: [{ type: "text", text: `this key lacks the required scope` }],
          isError: true,
        });
      }
      return rpcResult(id, await callTool(context.userId, tool.name, args.arguments));
    }

    default:
      return isNotification
        ? new Response(null, { status: 202 })
        : rpcError(id, -32601, `method not found: ${String(method)}`);
  }
}

/** No server-initiated streams and no session to terminate in this profile. */
export function GET(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
