import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4FinishReason,
  LanguageModelV4GenerateResult,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";

/**
 * The scripted model (ADR-075): a real `LanguageModelV4` that answers deterministically with no
 * provider key. It exists so the copilot is usable in a dev/demo/e2e environment and is labelled as
 * scripted everywhere it appears — it is never selected when a real key is configured.
 *
 * It can also emit a tool call, which is what lets the e2e suite exercise the approve/reject flow
 * without a paid provider: put a sentinel in the message, e.g.
 *
 *   [[tool:move_card:{"cardId":"…","toColumnName":"Done"}]]
 *
 * Anything else gets a short honest reply that names the scripted mode.
 */

const TOOL_SENTINEL = /\[\[tool:([A-Za-z0-9_]+):(\{[\s\S]*?\})\]\]/u;

function promptText(prompt: LanguageModelV4Prompt): string {
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    const message = prompt[index];
    if (!message || message.role !== "user") continue;
    return message.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
  }
  return "";
}

/** Rough token estimate — the scripted model has no tokenizer and this is never billed. */
const estimateTokens = (text: string): number => Math.max(1, Math.ceil(text.length / 4));

function usage(input: string, output: string): LanguageModelV4Usage {
  return {
    inputTokens: {
      total: estimateTokens(input),
      noCache: estimateTokens(input),
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: estimateTokens(output),
      text: estimateTokens(output),
      reasoning: undefined,
    },
  };
}

interface ScriptedOutput {
  toolName: string | null;
  toolCallId: string;
  input: string;
  text: string;
  usage: LanguageModelV4Usage;
  finishReason: LanguageModelV4FinishReason;
}

let callCounter = 0;

/** True when the last message is a tool result — the model is continuing right after a tool ran. */
function hasToolResult(prompt: LanguageModelV4Prompt): boolean {
  const last = prompt[prompt.length - 1];
  return last?.role === "tool";
}

function plan(options: LanguageModelV4CallOptions): ScriptedOutput {
  const text = promptText(options.prompt);
  const match = hasToolResult(options.prompt) ? null : TOOL_SENTINEL.exec(text);
  if (match?.[1] && match[2]) {
    const input = match[2];
    return {
      toolName: match[1],
      toolCallId: `scripted-call-${(callCounter += 1)}`,
      input,
      text: "",
      usage: usage(text, input),
      finishReason: { unified: "tool-calls", raw: undefined },
    };
  }

  const reply = hasToolResult(options.prompt)
    ? "Done — the action was applied. Anything else?"
    : [
        "This is the **scripted** copilot: no provider key is configured, so answers are canned.",
        "Connect a provider in `/settings/ai` for real responses.",
        "",
        text ? `You said: “${text.slice(0, 200)}”` : "Send a message to begin.",
      ].join("\n");
  return {
    toolName: null,
    toolCallId: "",
    input: "",
    text: reply,
    usage: usage(text, reply),
    finishReason: { unified: "stop", raw: undefined },
  };
}

export function scriptedModel(): LanguageModelV4 {
  return {
    specificationVersion: "v4",
    provider: "lifeos-scripted",
    modelId: "scripted",
    supportedUrls: {},
    async doGenerate(options): Promise<LanguageModelV4GenerateResult> {
      const output = plan(options);
      return {
        content: output.toolName
          ? [
              {
                type: "tool-call",
                toolCallId: output.toolCallId,
                toolName: output.toolName,
                input: output.input,
              },
            ]
          : [{ type: "text", text: output.text }],
        finishReason: output.finishReason,
        usage: output.usage,
        warnings: [],
      };
    },
    async doStream(options): Promise<LanguageModelV4StreamResult> {
      const output = plan(options);
      const chunks: LanguageModelV4StreamPart[] = [{ type: "stream-start", warnings: [] }];

      if (output.toolName) {
        const id = output.toolCallId;
        chunks.push(
          { type: "tool-input-start", id, toolName: output.toolName },
          { type: "tool-input-delta", id, delta: output.input },
          { type: "tool-input-end", id },
          { type: "tool-call", toolCallId: id, toolName: output.toolName, input: output.input },
        );
      } else {
        const id = "scripted-text-1";
        chunks.push(
          { type: "text-start", id },
          { type: "text-delta", id, delta: output.text },
          { type: "text-end", id },
        );
      }

      chunks.push({ type: "finish", usage: output.usage, finishReason: output.finishReason });
      return { stream: simulateReadableStream({ chunks }) };
    },
  };
}
