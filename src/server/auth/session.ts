import { headers } from "next/headers";

import { auth } from "./index";

/**
 * The one place the app reads the Better Auth session on the server (ADR-026). Every
 * authenticated surface — pages, Server Actions, route handlers — calls this, so the real
 * check (not the proxy's cookie heuristic) is always the gate.
 */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}
