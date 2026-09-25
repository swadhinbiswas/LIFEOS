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
