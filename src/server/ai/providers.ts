import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { aiScripted, env } from "@/env";

import { COMMANDCODE_BASE_URL, looksLikeClaude, ZDR_HEADER } from "./commandcode";
import { getDecryptedCredential } from "./credentials";
import type { AiPrefs, AiProvider } from "./prefs";
import { scriptedModel } from "./providers/scripted";

/**
 * Provider-agnostic model resolution (spec §8, ADR-075). Order:
 *   1. the user's own decrypted key for the selected provider,
 *   2. the operator's platform key for that provider,
 *   3. the deterministic scripted model when `AI_SCRIPTED=true`,
 *   4. otherwise `null` — the UI explains and links to `/settings/ai`.
 *
 * A provider is only usable when we also know a model id (from prefs, the credential, or the
 * operator default); we never invent a model name.
 */

export type ModelSource = "byo" | "platform" | "scripted";

export interface ResolvedModel {
  model: LanguageModel;
  provider: string;
  modelId: string;
  source: ModelSource;
}

/** Verified 2026-09-25: https://openrouter.ai/docs/api-reference/overview */
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const PROVIDERS: readonly AiProvider[] = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "commandcode",
  "compatible",
];

const isProvider = (value: string | undefined): value is AiProvider =>
  value !== undefined && (PROVIDERS as readonly string[]).includes(value);

export function platformKey(provider: AiProvider): string | undefined {
  switch (provider) {
    case "openai":
      return env.OPENAI_API_KEY;
    case "anthropic":
      return env.ANTHROPIC_API_KEY;
    case "google":
      return env.GOOGLE_GENERATIVE_AI_API_KEY;
    case "openrouter":
      return env.OPENROUTER_API_KEY;
    case "commandcode":
      return env.COMMANDCODE_API_KEY;
    case "compatible":
      return env.AI_COMPATIBLE_API_KEY;
  }
}

export interface BuildOptions {
  /** Command Code only: request zero data retention (ADR-134). */
  zdr?: boolean;
}

/** Exported so a test can prove the live request shape without a provider key. */
export function buildModel(
  provider: AiProvider,
  apiKey: string,
  modelId: string,
  options: BuildOptions = {},
): LanguageModel {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "openrouter":
      return createOpenAICompatible({
        name: "openrouter",
        baseURL: OPENROUTER_BASE_URL,
        apiKey,
      })(modelId);
    case "commandcode": {
      // Two documented shapes behind one base URL. Their docs are explicit that a Claude model
      // answers on `/v1/messages` only and is a 400 on `/v1/chat/completions`, so the shape is part
      // of addressing rather than a detail. `shapeFor` in ./commandcode is the decision function and
      // prefers their live catalog; this is the request-time fallback, and it is a naming rule the
      // code names as a rule.
      const headers = options.zdr ? { [ZDR_HEADER]: "1" } : undefined;
      if (looksLikeClaude(modelId)) {
        return createAnthropic({ apiKey, baseURL: COMMANDCODE_BASE_URL, headers })(modelId);
      }
      return createOpenAICompatible({
        name: "commandcode",
        baseURL: COMMANDCODE_BASE_URL,
        apiKey,
        ...(headers ? { headers } : {}),
      })(modelId);
    }
    case "compatible": {
      const baseURL = env.AI_COMPATIBLE_BASE_URL;
      if (!baseURL) throw new Error("AI_COMPATIBLE_BASE_URL is not set");
      // Ollama ignores the key but the provider wants one; "ollama" is a safe placeholder.
      return createOpenAICompatible({ name: "compatible", baseURL, apiKey })(modelId);
    }
  }
}

/** The provider we would talk to, given prefs, a platform key or the operator default. */
function pickProvider(prefs: AiPrefs): AiProvider | null {
  if (isProvider(prefs.provider)) return prefs.provider;
  if (isProvider(env.AI_DEFAULT_PROVIDER)) return env.AI_DEFAULT_PROVIDER;
  return PROVIDERS.find((provider) => platformKey(provider) !== undefined) ?? null;
}

export async function resolveModel(userId: string, prefs: AiPrefs): Promise<ResolvedModel | null> {
  const provider = pickProvider(prefs);
  if (provider) {
    const credential = await getDecryptedCredential(userId, provider);
    const key = credential?.key ?? platformKey(provider);
    const modelId = prefs.model ?? credential?.model ?? env.AI_DEFAULT_MODEL;
    if (key && modelId) {
      const source: ModelSource = credential ? "byo" : "platform";
      return {
        model: buildModel(provider, key, modelId, { zdr: prefs.commandCodeZdr }),
        provider,
        modelId,
        source,
      };
    }
  }

  if (aiScripted) {
    return {
      model: scriptedModel(),
      provider: "lifeos-scripted",
      modelId: "scripted",
      source: "scripted",
    };
  }
  return null;
}
