/**
 * REST envelope helpers (spec §9.1, ADR-063). Every error is the same shape:
 * `{ error: { code, message, details, request_id } }`, so a client needs one parser. `request_id`
 * is generated per response and echoed in logs.
 */

export const requestId = (): string => crypto.randomUUID();

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details: unknown = null,
): Response {
  return Response.json({ error: { code, message, details, request_id: requestId() } }, { status });
}

export const unauthorized = (): Response =>
  errorResponse(401, "unauthorized", "a valid API key or session is required");

export const forbidden = (): Response =>
  errorResponse(403, "forbidden", "this key does not have the required scope");

export const notFound = (): Response => errorResponse(404, "not_found", "not found");

export const badRequest = (message: string, details: unknown = null): Response =>
  errorResponse(400, "invalid", message, details);

export const conflict = (message: string): Response => errorResponse(409, "conflict", message);

export const rateLimited = (): Response =>
  errorResponse(429, "rate_limited", "too many requests — slow down and retry");

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}
