import { convertToModelMessages, type UIMessage } from "ai";

import { env } from "@/env";
import { newId } from "@/lib/id";
import { runCopilotTurn } from "@/server/ai/agent";
import { buildUserContext } from "@/server/ai/context";
import { ensureConversation, replaceMessages } from "@/server/ai/conversations";
import { resolveModel } from "@/server/ai/providers";
import { recordUsage, withinBudget } from "@/server/ai/usage";
import { getServerSession } from "@/server/auth/session";
import { getAiPrefs } from "@/server/settings";

/**
 * The copilot streaming endpoint (spec §8). Session-authenticated, budget-capped and provider-
 * agnostic: it resolves the model (BYO → platform → scripted), attaches the approval policy with a
 * signing secret, streams UI messages, and persists the conversation when the stream ends.
 */
export const runtime = "nodejs";

interface ChatBody {
  messages?: UIMessage[];
  id?: string;
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as ChatBody | null;
  const messages = body?.messages ?? [];
  if (!Array.isArray(messages)) {
    return Response.json({ error: "messages must be an array" }, { status: 400 });
  }

  const budget = await withinBudget(session.user.id);
  if (!budget.ok) {
    return Response.json({ error: "monthly AI limit reached" }, { status: 429 });
  }

  const prefs = await getAiPrefs(session.user.id);
  const resolved = await resolveModel(session.user.id, prefs);
  if (!resolved) {
    return Response.json(
      { error: "no AI provider configured — add a key in settings" },
      { status: 409 },
    );
  }

  const conversationId = await ensureConversation(session.user.id, body?.id ?? null);
  const [context, modelMessages] = await Promise.all([
    buildUserContext(session.user.id, prefs),
    convertToModelMessages(messages),
  ]);

  const userId = session.user.id;
  const result = runCopilotTurn({
    userId,
    model: resolved.model,
    messages: modelMessages,
    prefs,
    context,
    approvalSecret: env.TOOL_APPROVAL_SECRET,
    onFinish: async ({ inputTokens, outputTokens }) => {
      await recordUsage(userId, {
        conversationId,
        provider: resolved.provider,
        model: resolved.modelId,
        inputTokens,
        outputTokens,
      });
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: () => newId(),
    onEnd: async ({ messages: finalMessages }) => {
      await replaceMessages(userId, conversationId, finalMessages, {
        provider: resolved.provider,
        model: resolved.modelId,
      });
    },
  });
}
