import { and, desc, eq, isNull } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { ai_memories } from "@/server/db/schema";

/**
 * Durable copilot memory (spec §8, ADR-073): short facts the user has chosen to let the copilot
 * remember. The user always sees, edits and deletes every item here — nothing is remembered
 * silently — and the context builder only includes them when `memoryEnabled` is on (ADR-077).
 */

export interface MemoryItem {
  id: string;
  content: string;
  createdAt: string;
}

const MAX_LENGTH = 500;

const toView = (row: typeof ai_memories.$inferSelect): MemoryItem => ({
  id: row.id,
  content: row.content,
  createdAt: new Date(row.created_at).toISOString(),
});

export async function listMemories(userId: string, limit = 100): Promise<MemoryItem[]> {
  const rows = await db
    .select()
    .from(ai_memories)
    .where(and(eq(ai_memories.user_id, userId), isNull(ai_memories.deleted_at)))
    .orderBy(desc(ai_memories.created_at))
    .limit(limit);
  return rows.map(toView);
}

export async function addMemory(userId: string, content: string): Promise<MemoryItem> {
  const trimmed = content.trim().slice(0, MAX_LENGTH);
  if (trimmed === "") throw new Error("a memory cannot be empty");
  const [row] = await db
    .insert(ai_memories)
    .values({ id: newId(), user_id: userId, content: trimmed })
    .returning();
  if (!row) throw new Error("memory insert returned no row");
  return toView(row);
}

export async function updateMemory(
  userId: string,
  id: string,
  content: string,
): Promise<MemoryItem | null> {
  const trimmed = content.trim().slice(0, MAX_LENGTH);
  if (trimmed === "") throw new Error("a memory cannot be empty");
  const [row] = await db
    .update(ai_memories)
    .set({ content: trimmed, updated_at: new Date() })
    .where(
      and(eq(ai_memories.id, id), eq(ai_memories.user_id, userId), isNull(ai_memories.deleted_at)),
    )
    .returning();
  return row ? toView(row) : null;
}

/** Soft delete so the user's history is honest and a mis-click is recoverable. */
export async function deleteMemory(userId: string, id: string): Promise<void> {
  await db
    .update(ai_memories)
    .set({ deleted_at: new Date() })
    .where(and(eq(ai_memories.id, id), eq(ai_memories.user_id, userId)));
}
