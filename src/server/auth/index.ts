import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { APP_NAME } from "@/config/app";
import { env } from "@/env";
import { newId } from "@/lib/id";
import { db, schema } from "@/server/db";
import { user_settings } from "@/server/db/schema";
import { sendEmail } from "@/server/email";

import { secondaryStorage } from "./secondary-storage";

const baseURL = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL;
/** Public origin of the app itself — links that must land on *pages*, not on /api/auth. */
const appOrigin = env.NEXT_PUBLIC_APP_URL ?? env.BETTER_AUTH_URL ?? "http://localhost:3000";

/**
 * Better Auth 1.7.5 wired to the LifeOS ERD (ADRs 030/036/037).
 *
 * The model/column overrides below are a contract verified against
 * `@better-auth/core/…/get-tables.mjs` and the drizzle adapter dist at the pinned version:
 * overrides live in `options.<model>.{modelName,fields}` (not inside `drizzleAdapter`),
 * dates are `Date` values stored as integer ms by the `timestamp_ms` column mode, and the
 * adapter's default-on schema self-check compares `schema` object keys + Drizzle column
 * *property* keys against these resolved names. Re-read that source before renaming.
 */
export const auth = betterAuth({
  ...(baseURL ? { baseURL } : {}),
  secret: env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, { provider: "sqlite", schema }),

  // ERD §2.1 names — overrides only where snake_case differs from Better Auth's defaults.
  user: {
    modelName: "users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "sessions",
    storeSessionInDatabase: true, // DB = source of truth, secondary = cache (ADR-037)
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
      userId: "user_id",
      ipAddress: "ip",
      userAgent: "user_agent",
    },
  },
  account: {
    modelName: "accounts",
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "verifications",
    storeInDatabase: true, // reset/verify tokens must survive a cache flush (ADR-037)
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },

  // ADR-008: ids Better Auth generates are ULIDs, like every other LifeOS row.
  advanced: { database: { generateId: () => newId() } },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // spec §10 — acceptance flow verifies before sign-in
    // `url` is Better Auth's origin-checked hop (…/api/auth/reset-password/:token); the
    // forgot-password page passes redirectTo so it resolves to the spec §5 /reset-password
    // page with ?token=… — the page then posts auth.api.resetPassword with the same token.
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        kind: "reset",
        subject: `${APP_NAME} — reset your password`,
        text: `Reset your ${APP_NAME} password:\n\n${url}\n\nThe link expires in an hour. If you didn't request this, ignore this message.`,
        url,
      });
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, token }) => {
      // Better Auth's default link targets its raw API endpoint (JSON in a browser);
      // spec §5 gives /verify-email an (auth) page, so the mail lands there instead and
      // the page calls auth.api.verifyEmail with this same token (ADR-022 outbox record
      // carries the final URL the E2E follows).
      const url = `${appOrigin}/verify-email?token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: user.email,
        kind: "verify",
        subject: `${APP_NAME} — verify your email`,
        text: `Confirm your ${APP_NAME} email to finish signing up:\n\n${url}\n\nIf you didn't create this account, ignore this message.`,
        url,
      });
    },
    sendOnSignUp: true,
    // A lost first mail recovers by simply signing in again (ADR-037); BA's endpoint
    // rate limit (enabled below, research R13) bounds resend abuse.
    sendOnSignIn: true,
  },

  // ADR-023: provider blocks exist only when the env pair is complete — the sign-in page
  // shows a provider button under exactly the same condition.
  socialProviders: {
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
      : {}),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {}),
  },

  // ADR-037: always wired; backend follows ADR-021's env gate (stub in dev).
  secondaryStorage,
  // ADR-037: enabled in every environment, counters on the ADR-021 backend (stub in dev).
  // ADR-039: Better Auth's default special rules are 3 requests / 10 s for `/sign-in*` and
  // `/sign-up*` and 3 / 60 s for password-reset mail, keyed per client IP. The E2E suite
  // legitimately makes several sign-ins inside one window from a single localhost IP, so the
  // *ceiling* is env-tunable while the limiter itself stays on (dev/prod leave it unset).
  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    ...(env.AUTH_RATE_LIMIT_MAX !== undefined
      ? {
          customRules: {
            "/sign-in/email": { window: 10, max: env.AUTH_RATE_LIMIT_MAX },
            "/sign-up/email": { window: 10, max: env.AUTH_RATE_LIMIT_MAX },
            "/request-password-reset": { window: 60, max: env.AUTH_RATE_LIMIT_MAX },
          },
        }
      : {}),
  },

  // Every signup gets its settings row before the first read; the settings service
  // upserts anyway, so rows for users created before this hook also heal on save.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db
            .insert(user_settings)
            .values({ id: newId(), user_id: user.id })
            .onConflictDoNothing();
        },
      },
    },
  },

  plugins: [nextCookies()], // Next.js cookie jar — must stay the last plugin (BA docs)
});

export type Auth = typeof auth;
