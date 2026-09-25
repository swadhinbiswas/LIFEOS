/** @vitest-environment node */
import { generateText, tool, type ModelMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { toolApprovalFor } from "./agent";
import { DEFAULT_AI_PREFS } from "./prefs";

/**
 * Approval mechanics (spec §8, ADR-076/078). The real policy is attached to the AI SDK exactly as
 * the route attaches it, and a mock model is scripted to call a tool — so this proves, with no
 * provider key, that a read runs and a write cannot run without an approval response.
 */

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

const toolCallModel = (toolName: string, input: Record<string, unknown>) =>
  new MockLanguageModelV4({
    doGenerate: [
      {
        content: [
          { type: "tool-call", toolCallId: "call-1", toolName, input: JSON.stringify(input) },
        ],
        finishReason: { unified: "tool-calls", raw: undefined },
        usage,
        warnings: [],
      },
      {
        content: [{ type: "text", text: "done" }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      },
    ],
  });

const stubSearch = (spy: () => void) =>
  tool({
    description: "search",
    inputSchema: z.object({ query: z.string() }),
    execute: async () => {
      spy();
      return { ok: true };
    },
  });

const stubMove = (spy: () => void) =>
  tool({
    description: "move card",
    inputSchema: z.object({ cardId: z.string() }),
    execute: async () => {
      spy();
      return { ok: true };
    },
  });

describe("ai-copilot approval mechanics (spec §8, adr-076)", () => {
  it("runs a read tool without asking", async () => {
    const ran = vi.fn();
    const model = toolCallModel("search", { query: "invoices" });
    const result = await generateText({
      model,
      tools: { search: stubSearch(ran) },
      toolApproval: toolApprovalFor(DEFAULT_AI_PREFS),
      prompt: "find my invoices",
    });
    expect(ran).toHaveBeenCalledTimes(1);
    expect(result.content.some((part) => part.type === "tool-result")).toBe(true);
  });

  it("does not run a write tool until the user approves", async () => {
    const ran = vi.fn();
    const model = toolCallModel("move_card", { cardId: "card-1" });
    const messages: ModelMessage[] = [{ role: "user", content: "move card-1 to Done" }];

    const first = await generateText({
      model,
      tools: { move_card: stubMove(ran) },
      toolApproval: toolApprovalFor(DEFAULT_AI_PREFS),
      messages,
    });

    // The write is proposed, not performed.
    expect(ran).not.toHaveBeenCalled();
    const request = first.content.find((part) => part.type === "tool-approval-request");
    expect(request).toBeDefined();

    messages.push(...first.responseMessages);
    messages.push({
      role: "tool",
      content: [
        {
          type: "tool-approval-response",
          approvalId: (request as { approvalId: string }).approvalId,
          approved: true,
        },
      ],
    });

    await generateText({
      model,
      tools: { move_card: stubMove(ran) },
      toolApproval: toolApprovalFor(DEFAULT_AI_PREFS),
      messages,
    });
    expect(ran).toHaveBeenCalledTimes(1);
  });

  it("runs an allowlisted low-risk write without asking", async () => {
    const ran = vi.fn();
    const model = toolCallModel("create_card", { title: "buy milk" });
    const result = await generateText({
      model,
      tools: {
        create_card: tool({
          description: "create",
          inputSchema: z.object({ title: z.string() }),
          execute: async () => {
            ran();
            return { ok: true };
          },
        }),
      },
      toolApproval: toolApprovalFor({ ...DEFAULT_AI_PREFS, autoApprove: ["create_card"] }),
      prompt: "add a task",
    });
    expect(ran).toHaveBeenCalledTimes(1);
    expect(result.content.some((part) => part.type === "tool-result")).toBe(true);
  });

  it("fails closed when the policy denies a tool", async () => {
    const ran = vi.fn();
    const model = toolCallModel("delete_card", { cardId: "card-1" });
    const result = await generateText({
      model,
      tools: { delete_card: stubMove(ran) },
      toolApproval: toolApprovalFor({ ...DEFAULT_AI_PREFS, autoApprove: ["delete_card"] }),
      prompt: "delete card-1",
    });
    // Destructive tools always ask, even with a forged allowlist entry.
    expect(ran).not.toHaveBeenCalled();
    expect(result.content.some((part) => part.type === "tool-approval-request")).toBe(true);
  });

  it("rejects an approval whose tool input was tampered with after signing", async () => {
    const ran = vi.fn();
    const secret = "test-approval-secret-0123456789abcd";
    const model = toolCallModel("move_card", { cardId: "card-1" });
    const messages: ModelMessage[] = [{ role: "user", content: "move card-1 to Done" }];

    const first = await generateText({
      model,
      tools: { move_card: stubMove(ran) },
      toolApproval: toolApprovalFor(DEFAULT_AI_PREFS),
      experimental_toolApprovalSecret: secret,
      messages,
    });

    const request = first.content.find((part) => part.type === "tool-approval-request") as
      { approvalId: string } | undefined;
    expect(request).toBeDefined();

    // A hostile client replays the request but rewrites the tool input it was signed for.
    const replayed = JSON.parse(JSON.stringify(first.responseMessages)) as ModelMessage[];
    for (const message of replayed) {
      if (message.role === "assistant" && Array.isArray(message.content)) {
        for (const part of message.content as Array<{ type: string; input?: string }>) {
          if (part.type === "tool-call") part.input = JSON.stringify({ cardId: "attacker-target" });
        }
      }
    }

    await expect(
      generateText({
        model,
        tools: { move_card: stubMove(ran) },
        toolApproval: toolApprovalFor(DEFAULT_AI_PREFS),
        experimental_toolApprovalSecret: secret,
        messages: [
          ...messages,
          ...replayed,
          {
            role: "tool",
            content: [
              {
                type: "tool-approval-response",
                approvalId: request!.approvalId,
                approved: true,
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow();

    expect(ran).not.toHaveBeenCalled();
  });
});
