/** @vitest-environment node */
import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";

import { buildModel } from "./providers";

/**
 * The live provider path (spec §8, ADR-075): with no key the app uses the scripted model, but the
 * real path must be correct too. These tests stub `fetch` and assert the actual HTTP request a real
 * key would produce — endpoint, bearer auth and model id — without ever contacting a provider.
 */

const chatCompletion = (model: string, content: string) =>
  JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 1,
    model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
  });

/**
 * The Anthropic shape, which is a genuinely different envelope: `content` is a block array rather
 * than a string, and there is no `choices`. Stubbing the OpenAI body for a `/messages` call fails
 * in the SDK's response parser before any assertion runs, so a Claude test that reuses
 * `chatCompletion` is not testing the routing at all.
 */
const anthropicMessage = (model: string, content: string) =>
  JSON.stringify({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model,
    content: [{ type: "text", text: content }],
    stop_reason: "end_turn",
    usage: { input_tokens: 3, output_tokens: 1 },
  });

describe("live provider request shape (adr-075)", () => {
  it("calls OpenRouter with bearer auth and the chosen model", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      calls.push({ url: String(input), init: init as RequestInit });
      return new Response(chatCompletion("anthropic/claude-sonnet-5", "ok"), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    try {
      const model = buildModel("openrouter", "sk-or-test-key", "anthropic/claude-sonnet-5");
      const result = await generateText({ model, prompt: "say ok" });

      expect(result.text).toBe("ok");
      expect(calls.length).toBeGreaterThan(0);
      const call = calls[0]!;
      expect(call.url).toContain("openrouter.ai/api/v1");
      const headers = new Headers(call.init?.headers);
      expect(headers.get("authorization")).toBe("Bearer sk-or-test-key");
      const body = JSON.parse(String(call.init?.body)) as { model: string };
      expect(body.model).toBe("anthropic/claude-sonnet-5");
    } finally {
      spy.mockRestore();
    }
  });

  it("refuses an OpenAI-compatible model without a base URL", () => {
    expect(() => buildModel("compatible", "ollama", "llama3")).toThrow(/AI_COMPATIBLE_BASE_URL/u);
  });
});

/**
 * Command Code speaks two shapes behind one base URL (ADR-134), so the URL that actually goes on the
 * wire is the thing worth asserting. A wrong shape does not degrade the answer — their API rejects
 * it — so this is the test that distinguishes "the provider is configured" from "the provider is
 * usable".
 */
describe("command code request shape (adr-134)", () => {
  const capture = (body: (model: string, content: string) => string = chatCompletion) => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      calls.push({ url: String(input), init: init as RequestInit });
      return new Response(body("m", "ok"), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    return { calls, spy };
  };

  it("sends an OpenAI-shaped model to /chat/completions at their base URL", async () => {
    const { calls, spy } = capture();
    try {
      const model = buildModel("commandcode", "cmd-key", "deepseek/deepseek-v4-flash");
      await generateText({ model, prompt: "say ok" });

      const call = calls[0]!;
      expect(call.url).toBe("https://api.commandcode.ai/provider/v1/chat/completions");
      expect(new Headers(call.init?.headers).get("authorization")).toBe("Bearer cmd-key");
      expect((JSON.parse(String(call.init?.body)) as { model: string }).model).toBe(
        "deepseek/deepseek-v4-flash",
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("sends a Claude model to /messages instead — the same base URL, a different wire", async () => {
    // Their docs are explicit: a Claude model on /chat/completions is a 400. If this test ever fails
    // because someone "simplified" the routing to one shape, that is the bug it exists to catch.
    const { calls, spy } = capture(anthropicMessage);
    try {
      const model = buildModel("commandcode", "cmd-key", "claude-sonnet-4-6");
      await generateText({ model, prompt: "say ok" });

      const call = calls[0]!;
      expect(call.url).toBe("https://api.commandcode.ai/provider/v1/messages");
      const body = JSON.parse(String(call.init?.body)) as {
        model: string;
        max_tokens: number;
        messages: unknown[];
      };
      expect(body.model).toBe("claude-sonnet-4-6");
      // The Anthropic shape requires max_tokens and has no `messages` key collision; both are part
      // of being genuinely Anthropic-shaped rather than OpenAI-shaped with a different URL.
      expect(body.max_tokens).toBeGreaterThan(0);
      expect(Array.isArray(body.messages)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("adds x-cmd-zdr only when asked, and never silently", async () => {
    // Absent by default. Their docs note that turning ZDR on can change which upstream serves a
    // request, so the header has to be a decision, not a default.
    const off = capture();
    try {
      await generateText({ model: buildModel("commandcode", "k", "grok-4.7"), prompt: "ok" });
      expect(new Headers(off.calls[0]!.init?.headers).has("x-cmd-zdr")).toBe(false);
    } finally {
      off.spy.mockRestore();
    }

    const on = capture();
    try {
      const model = buildModel("commandcode", "k", "grok-4.7", { zdr: true });
      await generateText({ model, prompt: "ok" });
      expect(new Headers(on.calls[0]!.init?.headers).get("x-cmd-zdr")).toBe("1");
    } finally {
      on.spy.mockRestore();
    }
  });

  it("carries x-cmd-zdr on the Anthropic shape too", async () => {
    // A privacy flag that silently stopped applying to Claude models would be the worst version of
    // this feature: the user believes they are covered and is not.
    const { calls, spy } = capture(anthropicMessage);
    try {
      const model = buildModel("commandcode", "k", "claude-sonnet-4-6", { zdr: true });
      await generateText({ model, prompt: "ok" });
      expect(calls[0]!.url).toContain("/messages");
      expect(new Headers(calls[0]!.init?.headers).get("x-cmd-zdr")).toBe("1");
    } finally {
      spy.mockRestore();
    }
  });
});
