import { z } from "zod";

import { AUTO_APPROVABLE_TOOLS } from "./tools/catalog";

/**
 * AI preferences (spec §8, ADR-073): the non-secret half of the copilot settings, stored as JSON
 * in `user_settings.ai_prefs`. The provider **key** never lives here — it is encrypted in
 * `ai_credentials` (ADR-074).
 */

export const AI_PROVIDERS = ["openai", "anthropic", "google", "openrouter", "compatible"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

const autoApproveEnum = z.enum(AUTO_APPROVABLE_TOOLS as unknown as [string, ...string[]]);

export const aiPrefsSchema = z.object({
  provider: z.enum(AI_PROVIDERS).optional(),
  /** Model id for the selected provider (e.g. `gpt-5-mini`, `claude-sonnet-5`). */
  model: z.string().min(1).max(200).optional(),
  /** Low-risk write tools that run without a prompt (spec §8). Destructive tools are never here. */
  autoApprove: z.array(autoApproveEnum).max(AUTO_APPROVABLE_TOOLS.length).default([]),
  /** Whether the copilot may keep durable memory items (spec §8). */
  memoryEnabled: z.boolean().default(false),
  /** Proactive, off by default (spec §8): morning brief delivery. */
  morningBrief: z.enum(["off", "in_app", "email"]).default("off"),
  /** Proactive, off by default (spec §8): Friday review draft. */
  fridayReview: z.boolean().default(false),
});

export type AiPrefs = z.infer<typeof aiPrefsSchema>;

export const DEFAULT_AI_PREFS: AiPrefs = aiPrefsSchema.parse({});

/**
 * Parse the stored JSON liberally: a hand-edited or older column falls back to defaults rather
 * than breaking every copilot call (the same posture as `parseThemeOverrides`).
 */
export function parseAiPrefs(raw: string | null | undefined): AiPrefs {
  if (!raw) return DEFAULT_AI_PREFS;
  try {
    const parsed = aiPrefsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_AI_PREFS;
  } catch {
    return DEFAULT_AI_PREFS;
  }
}
