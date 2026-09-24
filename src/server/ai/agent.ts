import { isStepCount, streamText, type LanguageModel, type ModelMessage } from "ai";

import { approvalFor, type ApprovalDecision } from "./approval";
import type { AiPrefs } from "./prefs";
import { systemPrompt } from "./prompt";
import { buildAiTools } from "./tools";

/**
 * The copilot runtime (spec §8, ADR-076/077). This is the only place a model is given tools, and
 * the only place the approval policy is attached; the route (`/api/ai/chat`) calls it and streams
 * the result to `useChat`.
 *
 * `toolApprovalFor` is intentionally tiny and pure so the injection and approval guarantees can be
 * proven with a mock model and no provider key (evals, ADR-078).
 */

/** The AI SDK calls this before every tool; our policy decides, and fails closed. */
export function toolApprovalFor(prefs: AiPrefs) {
  return ({ toolCall }: { toolCall: { toolName: string } }): ApprovalDecision =>
    approvalFor(toolCall.toolName, prefs.autoApprove);
}

export { systemPrompt, untrusted } from "./prompt";

export interface RunCopilotTurnArgs {
  userId: string;
  model: LanguageModel;
  messages: ModelMessage[];
  prefs: AiPrefs;
  context: string;
  /** ADR-076: binds approvals to this server; a client-forged approval is rejected. */
  approvalSecret?: string;
  onFinish?: (event: {
    inputTokens: number;
    outputTokens: number;
    text: string;
  }) => Promise<void> | void;
}

/** Run one copilot turn with the tool layer and the approval policy attached. */
export function runCopilotTurn({
  userId,
  model,
  messages,
  prefs,
  context,
  approvalSecret,
  onFinish,
}: RunCopilotTurnArgs) {
  return streamText({
    model,
    system: systemPrompt(context),
    messages,
    tools: buildAiTools(userId),
    toolApproval: toolApprovalFor(prefs),
    stopWhen: isStepCount(8),
    ...(approvalSecret ? { experimental_toolApprovalSecret: approvalSecret } : {}),
    onFinish: onFinish
      ? async ({ usage, text }) => {
          const inputTokens = numeric(usage.inputTokens);
          const outputTokens = numeric(usage.outputTokens);
          await onFinish({ inputTokens, outputTokens, text });
        }
      : undefined,
  });
}

/** v7 usage tokens may be a number or a `{ total }` object depending on the provider. */
function numeric(value: number | { total?: number } | undefined): number {
  if (typeof value === "number") return value;
  return value?.total ?? 0;
}
