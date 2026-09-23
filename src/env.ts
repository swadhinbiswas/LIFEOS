/**
 * Single env contract (ADR-027): validated once at module load on the server.
 * Server-only — client code must never import this file.
 * Missing optional credentials map to documented fallbacks (ADRs 020–023),
 * never to a crash: file DB, in-memory rate limiter, file outbox, hidden OAuth.
 */
import { z } from "zod";

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
