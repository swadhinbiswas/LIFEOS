import { z } from "zod";

/**
 * The REST request/response contracts (spec §9.1, ADR-067). They live here rather than inside the
 * route files so the OpenAPI document is generated from the *same* schemas the routes validate
 * with — one definition, no drift. Dates are ISO strings on the wire and converted at the boundary.
 */

export const prioritySchema = z.enum(["p0", "p1", "p2", "p3"]);

export const createCardBody = z.object({
  title: z.string().trim().min(1).max(500),
  boardId: z.string().min(1).max(64).nullable().optional(),
  columnId: z.string().min(1).max(64).nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  priority: prioritySchema.nullable().optional(),
});

export const updateCardBody = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(20_000).nullable().optional(),
  priority: prioritySchema.nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  startAt: z.iso.datetime().nullable().optional(),
  estimateMin: z.number().int().min(0).max(100_000).nullable().optional(),
});

export const ingestBody = z.object({
  text: z.string().trim().min(1).max(1_000),
  columnName: z.string().trim().min(1).max(120).optional(),
});

/** The card shape the API returns (`serializeCard`), as a schema for the docs. */
export const cardSchema = z.object({
  id: z.string(),
  board_id: z.string(),
  column_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.string().nullable(),
  due_at: z.string().nullable(),
  start_at: z.string().nullable(),
  estimate_min: z.number().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number(),
});
