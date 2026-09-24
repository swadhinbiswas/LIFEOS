import { headers } from "next/headers";

import { scopeAllows, verifyApiKey } from "@/server/api-keys";
import { auth } from "@/server/auth";

/**
 * REST/MCP authentication (spec §9.1, ADR-063). A `Authorization: Bearer lifeos_live_…` API key
 * wins; otherwise the Better Auth session cookie is accepted so the web app can call the same
 * endpoints. Every downstream service call is scoped to `userId`, so the surface cannot leak.
 */

export interface ApiContext {
  userId: string;
  scopes: string[];
  /** Audit-friendly actor label. */
  actor: string;
}

export async function apiContext(request: Request): Promise<ApiContext | null> {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const identity = await verifyApiKey(header.slice("Bearer ".length).trim());
    if (!identity) return null;
    return { userId: identity.userId, scopes: identity.scopes, actor: `key:${identity.keyId}` };
  }

  // Outside a Next request scope `headers()` throws; treat that as unauthenticated (fail closed).
  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
  if (!session) return null;
  // A signed-in session acts with full rights over its own data.
  return { userId: session.user.id, scopes: ["read:*", "write:*"], actor: "session" };
}

export { scopeAllows };
