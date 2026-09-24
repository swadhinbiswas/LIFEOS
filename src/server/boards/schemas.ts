import { z } from "zod";

import { isValidRecurrence } from "./recurrence";

/**
 * Shared Zod contract for the board engine (spec §7.2): every adapter — Server Actions, REST
 * `/api/v1`, MCP and AI tools — validates with these schemas before calling the service, so
 * the service has exactly one input contract to test.
 */

export const prioritySchema = z.enum(["p0", "p1", "p2", "p3"]);
export const cardKindSchema = z.enum(["task", "job", "generic"]);

const timestamp = z.coerce.date();
const title = z.string().trim().min(1).max(500);
const description = z.string().max(20_000);
const estimate = z.number().int().min(0).max(100_000);

/** Full RRULE parse at the boundary — `rrule` rejects anything malformed. */
const recurrence = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(isValidRecurrence, "must be a valid RRULE, e.g. FREQ=WEEKLY;INTERVAL=1");

export const createBoardInput = z.object({
  name: z.string().trim().min(1).max(120),
  /** Template id from `config/board-templates.ts`; omit for a blank board. */
  template: z.string().trim().min(1).max(60).optional(),
});

export const updateBoardInput = z.object({
  boardId: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  /** `null` clears the archive; a date archives the board. */
  archived: z.boolean().optional(),
});

export const createColumnInput = z.object({
  boardId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  color: z.string().trim().max(40).nullable().optional(),
  glyph: z.string().trim().max(8).nullable().optional(),
  wipLimit: z.number().int().min(0).max(999).nullable().optional(),
  isDone: z.boolean().optional(),
});

export const updateColumnInput = z.object({
  columnId: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  color: z.string().trim().max(40).nullable().optional(),
  glyph: z.string().trim().max(8).nullable().optional(),
  wipLimit: z.number().int().min(0).max(999).nullable().optional(),
  isDone: z.boolean().optional(),
});

export const moveColumnInput = z.object({
  columnId: z.string().min(1),
  /** The column that should precede it, or null for the start of the board. */
  prevColumnId: z.string().min(1).nullable(),
  nextColumnId: z.string().min(1).nullable(),
});

export const createCardInput = z.object({
  boardId: z.string().min(1),
  columnId: z.string().min(1),
  title,
  description: description.optional(),
  priority: prioritySchema.nullable().optional(),
  dueAt: timestamp.nullable().optional(),
  startAt: timestamp.nullable().optional(),
  estimateMin: estimate.nullable().optional(),
  recurrence: recurrence.nullable().optional(),
  kind: cardKindSchema.optional(),
  /** Kind-specific payload (cover colour, job fields later) — free-form JSON. */
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const updateCardInput = z.object({
  cardId: z.string().min(1),
  /** ADR-011 optimistic-concurrency token; a mismatch is a 409 conflict. */
  version: z.number().int().min(0),
  title: title.optional(),
  description: description.nullable().optional(),
  priority: prioritySchema.nullable().optional(),
  dueAt: timestamp.nullable().optional(),
  startAt: timestamp.nullable().optional(),
  estimateMin: estimate.nullable().optional(),
  recurrence: recurrence.nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const moveCardInput = z.object({
  cardId: z.string().min(1),
  version: z.number().int().min(0),
  toColumnId: z.string().min(1),
  /** The card that should precede the moved card, or null for the top of the column. */
  prevCardId: z.string().min(1).nullable(),
  /** The card that should follow it, or null for the bottom of the column. */
  nextCardId: z.string().min(1).nullable(),
});

export const cardIdInput = z.object({ cardId: z.string().min(1) });

export const savedViewScopeSchema = z.enum(["tasks", "jobs", "board"]);

export const boardIdInput = z.object({ boardId: z.string().min(1) });

export const savedViewInput = z.object({
  scope: savedViewScopeSchema,
  name: z.string().trim().min(1).max(80),
  /** The board URL state (view/filter/group/q) as string params. */
  query: z.record(z.string(), z.string().max(500)),
});

export const savedViewScopeInput = z.object({ scope: savedViewScopeSchema });

export const savedViewIdInput = z.object({ id: z.string().min(1) });

export type CreateBoardInput = z.infer<typeof createBoardInput>;
export type UpdateBoardInput = z.infer<typeof updateBoardInput>;
export type CreateColumnInput = z.infer<typeof createColumnInput>;
export type UpdateColumnInput = z.infer<typeof updateColumnInput>;
export type MoveColumnInput = z.infer<typeof moveColumnInput>;
export type CreateCardInput = z.infer<typeof createCardInput>;
export type UpdateCardInput = z.infer<typeof updateCardInput>;
export type MoveCardInput = z.infer<typeof moveCardInput>;
