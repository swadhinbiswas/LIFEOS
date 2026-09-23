import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client (ADR-030). Deliberately thin: every call hits the same
 * `/api/auth/**` endpoints the server APIs use, and method names resolve from kebab paths
 * at call time (verified in `better-auth/dist/client/proxy.mjs` — `signIn.email` →
 * `/sign-in/email`, `verifyEmail({ query })` → GET, body-carrying calls → POST).
 */
export const authClient = createAuthClient();
