import {
  getPrompt,
  MCP_PROMPTS,
  MCP_RESOURCES,
  MCP_RESOURCE_TEMPLATES,
  readResource,
} from "@/server/api/mcp/catalog";
import { callTool, MCP_TOOLS } from "@/server/api/mcp/tools";
import { apiContext, scopeAllows } from "@/server/api/v1/context";
import { withinRateLimit } from "@/server/api/v1/support";

/**
 * MCP server (spec §9.2, ADR-064/071) over Streamable HTTP. Stateless: one JSON-RPC message per
 * POST, no `Mcp-Session-Id`. Replies are `application/json`, or a one-message `text/event-stream`
 * when the client asks for it — both are valid Streamable HTTP responses. Auth is a Bearer API key
 * (ADR-062); tools, resources and prompts are thin adapters over the services the UI calls.
 */

const JSONRPC = "2.0";
const SERVER_INFO = { name: "LifeOS", version: "0.0.1" };
const SUPPORTED_VERSIONS = ["2026-07-28", "2025-11-25", "2025-06-18"];
const LATEST_VERSION = SUPPORTED_VERSIONS[0] as string;

/** JSON by default; an SSE stream only when the client cannot take JSON (spec-compliant either way). */
function respond(request: Request, payload: unknown): Response {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream") && !accept.includes("application/json")) {
    return new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, {
      headers: { "content-type": "text/event-stream" },
    });
  }
  return Response.json(payload);
}

const rpcResult = (request: Request, id: unknown, result: unknown): Response =>
  respond(request, { jsonrpc: JSONRPC, id: id ?? null, result });

const rpcError = (
  request: Request,
  id: unknown,
  code: number,
  message: string,
  data?: unknown,
): Response =>
  respond(request, {
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
    return rpcError(request, null, -32700, "parse error");
  }
  if (Array.isArray(message)) {
    return rpcError(
      request,
      null,
      -32600,
      "batches are not supported; send one message per request",
    );
  }

  const { id, method, params } = (message ?? {}) as {
    id?: unknown;
    method?: unknown;
    params?: unknown;
  };
  const isNotification = id === undefined || id === null;
  const args = (params ?? {}) as {
    name?: unknown;
    arguments?: unknown;
    uri?: unknown;
    protocolVersion?: unknown;
  };

  switch (method) {
    case "initialize":
      return rpcResult(request, id, {
        protocolVersion: negotiate(args.protocolVersion),
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return new Response(null, { status: 202 });

    case "ping":
      return rpcResult(request, id, {});

    case "tools/list":
      return rpcResult(request, id, {
        tools: MCP_TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });

    case "tools/call": {
      if (typeof args.name !== "string") {
        return rpcError(request, id, -32602, "tools/call requires params.name");
      }
      const tool = MCP_TOOLS.find((candidate) => candidate.name === args.name);
      if (!tool) return rpcError(request, id, -32602, `unknown tool: ${args.name}`);
      if (!scopeAllows(context.scopes, tool.requiredScope)) {
        return rpcResult(request, id, {
          content: [{ type: "text", text: `this key lacks the required scope` }],
          isError: true,
        });
      }
      return rpcResult(request, id, await callTool(context.userId, tool.name, args.arguments));
    }

    case "resources/list":
      return rpcResult(request, id, { resources: MCP_RESOURCES });

    case "resources/templates/list":
      return rpcResult(request, id, { resourceTemplates: MCP_RESOURCE_TEMPLATES });

    case "resources/read": {
      if (typeof args.uri !== "string") {
        return rpcError(request, id, -32602, "resources/read requires params.uri");
      }
      if (!scopeAllows(context.scopes, "read:*")) {
        return rpcError(request, id, -32602, "this key lacks the required scope");
      }
      const result = await readResource(context.userId, args.uri);
      if ("error" in result) {
        return rpcError(request, id, -32602, result.error);
      }
      return rpcResult(request, id, result);
    }

    case "prompts/list":
      return rpcResult(request, id, {
        prompts: MCP_PROMPTS.map((prompt) => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
        })),
      });

    case "prompts/get": {
      if (typeof args.name !== "string") {
        return rpcError(request, id, -32602, "prompts/get requires params.name");
      }
      const prompt = getPrompt(args.name, (args.arguments ?? {}) as Record<string, unknown>);
      if (!prompt) return rpcError(request, id, -32602, `unknown prompt: ${args.name}`);
      return rpcResult(request, id, prompt);
    }

    default:
      return isNotification
        ? new Response(null, { status: 202 })
        : rpcError(request, id, -32601, `method not found: ${String(method)}`);
  }
}

/** No server-initiated streams and no session to terminate in this profile. */
export function GET(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
