import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/auth";

// ADR-030: Better Auth owns everything under /api/auth/**; no LifeOS logic lives here.
export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(auth);
