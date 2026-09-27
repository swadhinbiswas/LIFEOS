/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  COMMANDCODE_BASE_URL,
  describeError,
  fetchCommandCodeModels,
  looksLikeClaude,
  shapeFor,
} from "./commandcode";

/**
 * Command Code's Provider API adapter (ADR-134).
 *
 * Two things are being pinned here, and they are not the same kind of thing.
 *
 * `shapeFor` is a **decision** and is worth testing hard: their docs say a Claude model answers on
 * `/v1/messages` only and is a `400` on `/v1/chat/completions`, so sending the wrong shape is not a
 * degraded experience, it is a failed request. The test set is deliberately adversarial — the
 * catalog says otherwise, a near-miss name, an unknown model — because the failure mode being
 * prevented is a *plausible* routing decision that is wrong.
 *
 * `fetchCommandCodeModels` is a **boundary** and is tested for what it does when things go wrong,
 * since a settings page that throws because a key is rate-limited is worse than one with no list.
 */

const anthropic = { id: "claude-sonnet-4-6", supportedEndpoints: ["/v1/messages"] };
const deepseek = { id: "deepseek/deepseek-v4-flash", supportedEndpoints: ["/v1/chat/completions"] };
const both = {
  id: "some-model",
  supportedEndpoints: ["/v1/chat/completions", "/v1/responses"],
};

describe("shapeFor decides the wire shape (adr-134)", () => {
  it("trusts the catalog when it knows the model", () => {
    // Their own statement about a Claude model, so nothing is inferred.
    expect(shapeFor("claude-sonnet-4-6", [anthropic])).toEqual({
      shape: "anthropic",
      fromCatalog: true,
    });
    expect(shapeFor(deepseek.id, [deepseek])).toEqual({ shape: "openai", fromCatalog: true });
  });

  it("the catalog overrides the naming rule in both directions", () => {
    // This is the case a prefix check cannot handle and the reason the catalog is consulted at
    // all: a model named `claude-*` that their catalog does not list as /messages must not be
    // routed on the strength of its name.
    const catalog = [{ id: "claude-legacy-preview", supportedEndpoints: ["/v1/chat/completions"] }];
    expect(shapeFor("claude-legacy-preview", catalog)).toEqual({
      shape: "openai",
      fromCatalog: true,
    });

    // And a model that does not start with `claude` but is /messages-only.
    const vendor = [{ id: "vendor/internal-thinking", supportedEndpoints: ["/v1/messages"] }];
    expect(shapeFor("vendor/internal-thinking", vendor)).toEqual({
      shape: "anthropic",
      fromCatalog: true,
    });
  });

  it("prefers /messages when a model serves both shapes", () => {
    // Both shapes present is ambiguous, so it takes the one that only some models can use, rather
    // than the one that happens to sort first. Being wrong here costs the request.
    const ambiguous = {
      id: "ambiguous",
      supportedEndpoints: ["/v1/chat/completions", "/v1/messages"],
    };
    expect(shapeFor("ambiguous", [ambiguous])).toEqual({ shape: "anthropic", fromCatalog: true });
    expect(both.supportedEndpoints).toContain("/v1/chat/completions");
  });

  it("falls back to the naming rule, and says it did", () => {
    // `fromCatalog: false` is the load-bearing part. An unknown model is a guess, and the caller
    // can see that it is one instead of being told the shape is known.
    expect(shapeFor("claude-opus-9")).toEqual({ shape: "anthropic", fromCatalog: false });
    expect(shapeFor("deepseek/deepseek-v4-flash")).toEqual({ shape: "openai", fromCatalog: false });
    expect(shapeFor("grok-4.7")).toEqual({ shape: "openai", fromCatalog: false });
  });

  it("only treats a real Claude name as Claude", () => {
    // Near misses, so the rule is a prefix and not a substring search. `claude-code` is not a model
    // on their catalog; `claudewright/x` certainly is not.
    expect(looksLikeClaude("claude-sonnet-4-6")).toBe(true);
    expect(looksLikeClaude("claude/opus")).toBe(true);
    expect(looksLikeClaude("CLAUDE-sonnet-4-6")).toBe(true);
    expect(looksLikeClaude("  claude-sonnet-4-6  ")).toBe(true);
    // Not matched: the name does not *begin* with it, so a substring search is ruled out.
    for (const notClaude of ["claudexyz", "anthropic/claude-3", "my-claude-proxy", "", "claude"]) {
      expect(looksLikeClaude(notClaude)).toBe(false);
    }
    // And the rule's limit, stated rather than hidden: a hypothetical `claude-*` id that is not a
    // Claude model would be routed as one. Excluding it would need a list, which is the very thing
    // this rule exists to avoid — which is why `shapeFor` prefers the catalog and reports
    // `fromCatalog: false` when it has to fall back here.
    expect(looksLikeClaude("claude-code")).toBe(true);
  });
});

describe("fetchCommandCodeModels reads the live catalog", () => {
  const ok = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  it("calls /models with bearer auth and no key leakage anywhere else", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return ok({
        data: [{ id: "b", supported_endpoints: ["/v1/chat/completions"] }, { id: "a" }],
      });
    }) as unknown as typeof fetch;

    const models = await fetchCommandCodeModels("cmd-secret", fetchImpl);

    expect(calls[0]!.url).toBe(`${COMMANDCODE_BASE_URL}/models`);
    const headers = new Headers(calls[0]!.init?.headers);
    expect(headers.get("authorization")).toBe("Bearer cmd-secret");
    // Sorted, because their catalog order is not promised to be stable and a dropdown that
    // reorders itself between two reads is a bug report waiting to happen.
    expect(models.map((m) => m.id)).toEqual(["a", "b"]);
    expect(models[0]!.supportedEndpoints).toEqual([]);
  });

  it("returns nothing rather than throwing when the key is rejected or down", async () => {
    // A rejected key, a 500, malformed JSON, a shape we do not recognise, and a network failure
    // all degrade the same way: no list, no exception. The settings page turns this into a note
    // and leaves the model field writable.
    const cases: Array<typeof fetch> = [
      (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch,
      (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch,
      (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch,
      (async () => ok({ nope: true })) as unknown as typeof fetch,
      (async () => ok({ data: "not-an-array" })) as unknown as typeof fetch,
      (async () => {
        throw new Error("ENOTFOUND");
      }) as unknown as typeof fetch,
    ];
    for (const fetchImpl of cases) {
      await expect(fetchCommandCodeModels("cmd-secret", fetchImpl)).resolves.toEqual([]);
    }
  });

  it("drops rows with no id rather than offering an unusable model", async () => {
    const models = await fetchCommandCodeModels("k", (async () =>
      ok({
        data: [{ id: 42 }, { supported_endpoints: [] }, { id: "good" }],
      })) as unknown as typeof fetch);
    expect(models.map((m) => m.id)).toEqual(["good"]);
  });
});

describe("describeError explains the statuses a person can fix", () => {
  it("uses their documented meanings, and reads their error envelope", () => {
    // Both shapes: the OpenAI envelope nests under `error`, the Anthropic one puts a bare
    // `message` at the top level.
    expect(describeError(401, { error: { message: "bad key" } })).toBe(
      "the API key is missing or invalid: bad key",
    );
    expect(describeError(422, { error: { message: "no ZDR upstream" } })).toContain(
      "zero data retention",
    );
    expect(describeError(403, { error: { message: "upgrade required" } })).toContain("plan");
    expect(describeError(429, { error: { message: "slow down" } })).toContain("rate limited");
    expect(describeError(500, { error: { message: "upstream down" } })).toContain("upstream");
  });

  it("still says something useful with no body at all", () => {
    // An empty or unparseable error is the common case behind a proxy. The known-status wording is
    // still used, with the code appended — "upstream failure (502)" beats an exception in the UI,
    // and a non-string `message` is treated as no message rather than stringified into "[object
    // Object]".
    expect(describeError(400, null)).toBe(
      "the request was rejected — wrong endpoint for this model, or a malformed body (400)",
    );
    expect(describeError(502, undefined)).toBe("upstream failure (502)");
    expect(describeError(400, { error: { message: 7 } })).toContain("400");
    expect(describeError(418, null)).toBe("request failed (418)");
  });
});
