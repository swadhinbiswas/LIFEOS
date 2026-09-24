import { and, asc, desc, eq, notInArray, sql } from "drizzle-orm";
import type { UIMessage } from "ai";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { ai_conversations, ai_messages } from "@/server/db/schema";

/**
 * Copilot conversations (spec §8, ADR-073). The client owns the message list (that is how `useChat`
 * works and how approvals are replayed); this service is the durable copy so history survives a
 * reload. Parts are stored verbatim, including approval requests, so a reload re-verifies the same
 * signed approval rather than inventing a new one.
 */

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: Date;
}

/** Return an owned conversation id, creating one when absent or foreign. */
export async function ensureConversation(
  userId: string,
  conversationId?: string | null,
): Promise<string> {
  if (conversationId) {
    const [existing] = await db
      .select({ id: ai_conversations.id })
      .from(ai_conversations)
      .where(and(eq(ai_conversations.id, conversationId), eq(ai_conversations.user_id, userId)))
      .limit(1);
    if (existing) return existing.id;
  }
  const id = newId();
  await db.insert(ai_conversations).values({ id, user_id: userId, title: "" });
  return id;
}

export async function listConversations(
  userId: string,
  limit = 30,
): Promise<ConversationSummary[]> {
  return db
    .select({
      id: ai_conversations.id,
      title: ai_conversations.title,
      updated_at: ai_conversations.updated_at,
    })
    .from(ai_conversations)
    .where(eq(ai_conversations.user_id, userId))
    .orderBy(desc(ai_conversations.updated_at))
    .limit(limit);
}

/** Load one conversation's messages, oldest first, reconstructed as `UIMessage`s. */
export async function getConversationMessages(
  userId: string,
  conversationId: string,
): Promise<UIMessage[] | null> {
  const [conversation] = await db
    .select({ id: ai_conversations.id })
    .from(ai_conversations)
    .where(and(eq(ai_conversations.id, conversationId), eq(ai_conversations.user_id, userId)))
    .limit(1);
  if (!conversation) return null;

  const rows = await db
    .select({ id: ai_messages.id, role: ai_messages.role, parts: ai_messages.parts })
    .from(ai_messages)
    .where(eq(ai_messages.conversation_id, conversationId))
    .orderBy(asc(ai_messages.created_at));

  return rows.map(
    (row) =>
      ({
        id: row.id,
        role: row.role as UIMessage["role"],
        parts: JSON.parse(row.parts) as UIMessage["parts"],
      }) satisfies UIMessage,
  );
}

/** Replace the stored history with the client's authoritative list (small, per-user). */
export async function replaceMessages(
  userId: string,
  conversationId: string,
  messages: UIMessage[],
  meta: { provider: string; model: string },
): Promise<void> {
  const ids = messages.map((message) => message.id || newId());

  // Remove rows that are no longer in the history (nothing to remove when the list is empty).
  if (ids.length > 0) {
    await db
      .delete(ai_messages)
      .where(and(eq(ai_messages.conversation_id, conversationId), notInArray(ai_messages.id, ids)));
  } else {
    await db.delete(ai_messages).where(eq(ai_messages.conversation_id, conversationId));
  }

  if (messages.length > 0) {
    // Upsert by id: overlapping turns (an approval round-trip) must not collide.
    await db
      .insert(ai_messages)
      .values(
        messages.map((message, index) => ({
          id: ids[index]!,
          conversation_id: conversationId,
          user_id: userId,
          role: message.role,
          parts: JSON.stringify(message.parts),
          provider: meta.provider,
          model: meta.model,
        })),
      )
      .onConflictDoUpdate({
        target: ai_messages.id,
        set: {
          conversation_id: conversationId,
          role: sql`excluded.role`,
          parts: sql`excluded.parts`,
          provider: meta.provider,
          model: meta.model,
        },
      });
  }

  const firstUser = messages.find((message) => message.role === "user");
  const title = firstUser ? textOf(firstUser).slice(0, 80) : "";
  await db
    .update(ai_conversations)
    .set({ title, updated_at: new Date() })
    .where(and(eq(ai_conversations.id, conversationId), eq(ai_conversations.user_id, userId)));
}

/** Best-effort plain text of a UIMessage, for the conversation title. */
function textOf(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}
