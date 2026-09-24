import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { users } from "./identity";

/**
 * AI copilot tables (spec §8, ADR-073). Every row is user-owned and every query filters the
 * authenticated user; the only writers are the services in `src/server/ai`.
 *
 * - `ai_credentials` holds BYO provider keys as AES-256-GCM ciphertext (ADR-074). The plaintext
 *   is decrypted only inside the server-side model factory and is never returned to a client.
 * - `ai_messages.parts` stores the AI SDK `UIMessage.parts` verbatim, so a tool-approval request
 *   survives a reload exactly as it was issued (its signature is re-verified, ADR-076).
 * - `audit_log` is the generic §7.3 trail; the copilot writes `actor = "ai"` rows here.
 */

const timestamps = () => ({
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const ai_credentials = sqliteTable(
  "ai_credentials",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** openai | anthropic | google | openrouter | compatible */
    provider: text("provider").notNull(),
    /** iv.tag.ciphertext, base64 (ADR-074). */
    secret_encrypted: text("secret_encrypted").notNull(),
    /** Last four characters, the only part ever shown back. */
    hint: text("hint").notNull(),
    /** Optional per-credential model override. */
    model: text("model"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("ai_credentials_user_provider_idx").on(t.user_id, t.provider),
    index("ai_credentials_user_idx").on(t.user_id),
  ],
);

export const ai_conversations = sqliteTable(
  "ai_conversations",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    archived_at: integer("archived_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [index("ai_conversations_user_idx").on(t.user_id, t.updated_at)],
);

export const ai_messages = sqliteTable(
  "ai_messages",
  {
    id: text("id").primaryKey(),
    conversation_id: text("conversation_id")
      .notNull()
      .references(() => ai_conversations.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** user | assistant | system | tool */
    role: text("role").notNull(),
    /** AI SDK UIMessage parts as JSON (ADR-073). */
    parts: text("parts").notNull().default("[]"),
    provider: text("provider"),
    model: text("model"),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversation_id, t.created_at)],
);

export const ai_usage = sqliteTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversation_id: text("conversation_id").references(() => ai_conversations.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    input_tokens: integer("input_tokens").notNull().default(0),
    output_tokens: integer("output_tokens").notNull().default(0),
    /** Rough cost in millionths of a currency unit (spec §8 "rough token cost"). */
    cost_micros: integer("cost_micros").notNull().default(0),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("ai_usage_user_idx").on(t.user_id, t.created_at)],
);

export const ai_memories = sqliteTable(
  "ai_memories",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    deleted_at: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [index("ai_memories_user_idx").on(t.user_id, t.created_at)],
);

export const audit_log = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** ai | mcp:<client> | user | system (spec §7.3, §8). */
    actor: text("actor").notNull(),
    /** A stable verb, e.g. `ai.tool.create_card`. */
    action: text("action").notNull(),
    target_type: text("target_type"),
    target_id: text("target_id"),
    /** JSON detail, kept small and free of secrets. */
    detail: text("detail"),
    created_at: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("audit_log_user_idx").on(t.user_id, t.created_at)],
);
