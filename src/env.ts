/**
 * Single env contract (ADR-027): validated once at module load on the server.
 * Server-only — client code must never import this file.
 * Missing optional credentials map to documented fallbacks (ADRs 020–023),
 * never to a crash: file DB, in-memory rate limiter, file outbox, hidden OAuth.
 */
import { z } from "zod";

// ADR-027: this module also loads under drizzle-kit, vitest and playwright, where nothing
// has read .env yet. loadEnvFile never overrides variables already in process.env (verified
// on Node 24), so Next.js's own .env handling is unaffected; a missing file is normal in CI.
try {
  process.loadEnvFile();
} catch {
  /* no .env — variables come from the process environment */
}

const pairs: Array<[string, string]> = [
  ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
];

const envSchema = z
  .object({
    // ADR-020: file:.data/lifeos.db for dev/test, libsql://… (+ token) for Turso
    DATABASE_URL: z.string().min(1),
    TURSO_AUTH_TOKEN: z.string().min(1).optional(),
    // ADR-030: required always — dev/.env gets a locally generated value, CI generates per run
    BETTER_AUTH_SECRET: z.string().min(16),
    BETTER_AUTH_URL: z.url().optional(),
    NEXT_PUBLIC_APP_URL: z.url().optional(),
    // ADR-092: extra origins Better Auth accepts state-changing requests from (CSRF check), as a
    // comma-separated list. Needed when the app is reached on a host other than the base URL
    // (a LAN IP, a tunnel, a second domain). Development also trusts the machine's own addresses.
    TRUSTED_ORIGINS: z.string().optional(),
    // ADR-021: both or neither (enforced below); absent = in-memory dev fallback
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    // ADR-022: present = Resend, absent = file outbox in .data/outbox
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    // ADR-023: both or neither (enforced below); absent = provider buttons hidden
    GITHUB_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    // ADR-013: keep false until Dodo go-live
    BILLING_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    // ADR-039: optional ceiling for the auth rate-limit special rules. The limiter stays on
    // everywhere (ADR-037); the E2E run raises the ceiling because BA's defaults (3 / 10 s for
    // /sign-in*) assume distinct client IPs and the suite signs in several times from localhost.
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
    // ADR-069: guards the webhook retry cron route. Absent = the route is hidden (404).
    CRON_SECRET: z.string().min(16).optional(),
    // --- AI copilot (ADR-073…078) ---
    // ADR-074: 32-byte key (base64) for AES-256-GCM at-rest secrets. Absent = a dev/test key
    // derived from BETTER_AUTH_SECRET; in production, absent disables saving provider keys.
    AI_ENCRYPTION_KEY: z.string().min(1).optional(),
    // ADR-076: HMAC-signs tool approvals so a client-forged approval is rejected. Absent =
    // approvals are still required, but not cryptographically bound (dev only).
    TOOL_APPROVAL_SECRET: z.string().min(16).optional(),
    // ADR-075: deterministic scripted model for dev/demo/e2e when no provider key is configured.
    AI_SCRIPTED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    // Operator (platform) provider keys — any one enables that provider for every user.
    OPENAI_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    // Ollama or any OpenAI-compatible endpoint (ADR-075).
    AI_COMPATIBLE_BASE_URL: z.url().optional(),
    AI_COMPATIBLE_API_KEY: z.string().min(1).optional(),
    AI_DEFAULT_PROVIDER: z.string().min(1).optional(),
    AI_DEFAULT_MODEL: z.string().min(1).optional(),
    // --- Billing (ADR-013/080/081): all optional; billing UI stays hidden unless enabled + keyed ---
    DODO_PAYMENTS_API_KEY: z.string().min(1).optional(),
    DODO_PAYMENTS_WEBHOOK_KEY: z.string().min(1).optional(),
    DODO_PAYMENTS_RETURN_URL: z.url().optional(),
    DODO_PAYMENTS_ENVIRONMENT: z.enum(["test_mode", "live_mode"]).optional(),
    /** Product ids from the Dodo dashboard; a plan without one is not offered. */
    DODO_PRODUCT_PRO: z.string().min(1).optional(),
    DODO_PRODUCT_TEAM: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    for (const [a, b] of pairs) {
      const hasA = env[a as keyof typeof env] !== undefined;
      const hasB = env[b as keyof typeof env] !== undefined;
      if (hasA !== hasB) {
        ctx.addIssue({
          code: "custom",
          message: `${a} and ${b} must be set together (or both left empty)`,
          path: [hasA ? b : a],
        });
      }
    }
    if (env.TURSO_AUTH_TOKEN && env.DATABASE_URL.startsWith("file:")) {
      ctx.addIssue({
        code: "custom",
        message: "TURSO_AUTH_TOKEN requires a libsql:// DATABASE_URL, not a file: URL",
        path: ["TURSO_AUTH_TOKEN"],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}\nSee .env.example.`);
}

export const env = Object.freeze(parsed.data);

/** ADR-021 — real Upstash client when configured */
export const hasUpstash = Boolean(env.UPSTASH_REDIS_REST_URL);
/** ADR-022 — Resend transport when keyed */
export const hasResend = Boolean(env.RESEND_API_KEY);
/** ADR-023 — OAuth providers offered ⇔ env complete */
export const hasGithub = Boolean(env.GITHUB_CLIENT_ID);
export const hasGoogle = Boolean(env.GOOGLE_CLIENT_ID);
/** ADR-020 — cloud (Turso) vs local file database */
export const isCloudDb =
  env.DATABASE_URL.startsWith("libsql://") || env.DATABASE_URL.startsWith("https://");
/** ADR-013 — billing stays hidden until go-live */
export const billingEnabled = env.BILLING_ENABLED;
/** ADR-075 — the scripted model is available when explicitly enabled (dev/demo/e2e). */
export const aiScripted = env.AI_SCRIPTED;
/** ADR-074 — at-rest encryption is usable (real key, or the documented dev/test fallback). */
export const hasAiEncryption =
  Boolean(env.AI_ENCRYPTION_KEY) || process.env.NODE_ENV !== "production";
/** ADR-075 — at least one platform provider key is configured. */
export const hasPlatformAi = Boolean(
  env.OPENAI_API_KEY ||
  env.ANTHROPIC_API_KEY ||
  env.GOOGLE_GENERATIVE_AI_API_KEY ||
  env.OPENROUTER_API_KEY ||
  env.AI_COMPATIBLE_BASE_URL,
);
/**
 * ADR-080/082 — billing is available only when the flag is on **and** the Dodo keys and webhook
 * secret are present. Everything billing-related keys off this single signal.
 */
export const billingReady =
  billingEnabled && Boolean(env.DODO_PAYMENTS_API_KEY && env.DODO_PAYMENTS_WEBHOOK_KEY);
export const dodoEnvironment = env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode";
