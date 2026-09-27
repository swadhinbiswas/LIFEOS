/**
 * Command Code's Provider API (ADR-134).
 *
 * One API in front of Claude, GPT, Gemini and the open models, pay-as-you-go, OpenAI- **and**
 * Anthropic-shaped. That second shape is the part that decides the design here, because their
 * documentation is explicit that a Claude model answers on `/v1/messages` **only** — sending one to
 * `/v1/chat/completions` is a `400 invalid_request_error`. So "add a provider" is not one
 * `createOpenAICompatible` call; it is a choice of shape per model, and the honest source for that
 * choice is their own catalog rather than a string comparison on a model name.
 *
 * **Verified 2026-09-27** against the Provider API documentation.
 */

/** The base every documented endpoint hangs off. */
export const COMMANDCODE_BASE_URL = "https://api.commandcode.ai/provider/v1";

/** Zero data retention. Their documented per-request opt-in, same as the CLI's `CMD_ZDR=1`. */
export const ZDR_HEADER = "x-cmd-zdr";

/** The wire shapes their API speaks. `/responses` is OpenAI-shaped and is not used here. */
export type CommandCodeShape = "openai" | "anthropic";

/**
 * One entry from `GET /provider/v1/models`.
 *
 * `supportedEndpoints` is the field their docs point at for exactly this decision: "check there
 * before you pick an endpoint". We keep it rather than reducing it to a boolean, because a model can
 * serve both shapes and the caller may want to know that.
 */
export interface CommandCodeModel {
  id: string;
  supportedEndpoints: string[];
}

/**
 * The shape a model must be called with.
 *
 * **Prefers the catalog, falls back to a documented naming rule, and never guesses silently.**
 *
 * - `/messages` in `supportedEndpoints` → Anthropic. That is their own statement.
 * - `/chat/completions` → OpenAI. Their default: "OpenAI and open models answer on
 *   /v1/chat/completions".
 * - **Unknown model** → decided by {@link looksLikeClaude}. Every Claude model on their catalog is
 *   named `claude-*`, and there is no way to know the answer without a catalog read, so the fallback
 *   is a naming rule **and it is reported as a heuristic** by {@link shapeFor}'s sibling
 *   {@link shapeIsHeuristic}, rather than being passed off as knowledge.
 */
export function shapeFor(
  modelId: string,
  catalog: readonly CommandCodeModel[] = [],
): { shape: CommandCodeShape; fromCatalog: boolean } {
  const entry = catalog.find((model) => model.id === modelId);
  if (entry) {
    if (entry.supportedEndpoints.some((endpoint) => endpoint.includes("/messages"))) {
      return { shape: "anthropic", fromCatalog: true };
    }
    return { shape: "openai", fromCatalog: true };
  }
  return { shape: looksLikeClaude(modelId) ? "anthropic" : "openai", fromCatalog: false };
}

/** The naming rule, isolated and named, because it is a rule and not a fact. */
export function looksLikeClaude(modelId: string): boolean {
  return /^claude[-/]/iu.test(modelId.trim());
}

/** The `messages` array of the documented error envelope, for a message worth showing a person. */
export function describeError(status: number, body: unknown): string {
  const record = body as { error?: { message?: unknown }; message?: unknown } | null;
  const message =
    (typeof record?.error?.message === "string" && record.error.message) ||
    (typeof record?.message === "string" && record.message) ||
    null;
  // Their documented meanings for the statuses a person can actually fix.
  const known: Record<number, string> = {
    400: "the request was rejected — wrong endpoint for this model, or a malformed body",
    401: "the API key is missing or invalid",
    403: "this plan has no API access (the Go plan is the exception)",
    422: "zero data retention was requested but this model has no ZDR-capable upstream",
    429: "rate limited by the upstream — retry with backoff",
  };
  const prefix = known[status] ?? (status >= 500 ? "upstream failure" : "request failed");
  return message ? `${prefix}: ${message}` : `${prefix} (${status})`;
}

const TIMEOUT_MS = 8_000;

/**
 * The live catalog, read with the caller's key.
 *
 * **Server-side only.** The key is a credential decrypted inside the server (ADR-074) and is never
 * returned to a client, so this cannot be called from the browser. It exists so the settings page can
 * offer the models that are actually available rather than a list typed from documentation — their
 * catalog changes, and a hardcoded list is a list that is wrong by the next release.
 *
 * Returns an empty array on any failure. A settings page with no model list is a small degradation;
 * a settings page that throws because somebody's key is rate-limited is a worse one.
 */
export async function fetchCommandCodeModels(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CommandCodeModel[]> {
  try {
    const response = await fetchImpl(`${COMMANDCODE_BASE_URL}/models`, {
      headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as {
      data?: Array<{ id?: unknown; supported_endpoints?: unknown }>;
    };
    const rows = Array.isArray(body.data) ? body.data : [];
    return (
      rows
        .filter(
          (row): row is { id: string; supported_endpoints?: unknown } => typeof row.id === "string",
        )
        .map((row) => ({
          id: row.id,
          supportedEndpoints: Array.isArray(row.supported_endpoints)
            ? row.supported_endpoints.filter(
                (endpoint): endpoint is string => typeof endpoint === "string",
              )
            : [],
        }))
        // Sorted so the dropdown is stable between reads; their catalog order is not promised to be.
        .sort((a, b) => a.id.localeCompare(b.id))
    );
  } catch {
    return [];
  }
}
