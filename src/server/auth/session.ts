import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "./index";

/**
 * The shared session read path for server-rendered pages and actions (ADR-026). Pages call this
 * rather than the proxy's cookie heuristic, so the real check is always the gate. Route handlers
 * that need a mutation-specific check may call Better Auth directly.
 *
 * `cache()` is request-scoped in React Server Components: a layout and its page can ask for the
 * same session without paying two secondary-storage lookups. It does not create a process-global
 * user cache; outside a React request dispatcher React simply calls the function normally.
 */
export const getServerSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
