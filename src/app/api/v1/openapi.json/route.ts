import { openApiDocument } from "@/server/api/openapi";

/**
 * `/api/v1/openapi.json` (spec §9.1, ADR-067). Public: a spec is documentation, and it contains no
 * user data. Generated from the same Zod schemas the routes validate with.
 */
export function GET(): Response {
  return Response.json(openApiDocument());
}
