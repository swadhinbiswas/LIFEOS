import { z } from "zod";

import { cardSchema, createCardBody, ingestBody, updateCardBody } from "./v1/schemas";

/**
 * OpenAPI 3.1 for the REST surface (spec §9.1, ADR-067). The request schemas are the *same* Zod
 * objects the routes validate with, converted with Zod's built-in `z.toJSONSchema` (JSON Schema
 * 2020-12, which OpenAPI 3.1 uses) — so the document cannot drift from the implementation and no
 * extra dependency is needed.
 */

const jsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const output = z.toJSONSchema(schema) as Record<string, unknown>;
  delete output.$schema;
  return output;
};

const applyUserNote =
  "Session cookies also authenticate the web app; scripts use a Bearer key (Settings → Integrations).";

const errorResponse = {
  description: "The shared error envelope",
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  },
} as const;

const cardPageResponse = {
  description: "A page of cards",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/Card" } },
          next_cursor: { type: ["string", "null"] },
        },
        required: ["data", "next_cursor"],
      },
    },
  },
} as const;

const cardResponse = {
  description: "A single card",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: { data: { $ref: "#/components/schemas/Card" } },
        required: ["data"],
      },
    },
  },
} as const;

const idempotencyHeader = {
  name: "Idempotency-Key",
  in: "header",
  required: false,
  schema: { type: "string" },
  description: "A successful response is replayed for 24 h under the same key.",
} as const;

const listParameters = [
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
  { name: "cursor", in: "query", schema: { type: "string" }, description: "Opaque `next_cursor`." },
  { name: "board_id", in: "query", schema: { type: "string" } },
  { name: "q", in: "query", schema: { type: "string" }, description: "Title substring." },
  {
    name: "fields",
    in: "query",
    schema: { type: "string" },
    description: "Comma-separated field names for a sparse response.",
  },
] as const;

export function openApiDocument(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "LifeOS API",
      version: "0.0.1",
      description: `REST surface over the same services the app uses (spec §9.1). ${applyUserNote}`,
    },
    servers: [{ url: "/" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Personal API key: `lifeos_live_…`",
        },
      },
      schemas: {
        Card: jsonSchema(cardSchema),
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: {},
                request_id: { type: "string" },
              },
              required: ["code", "message", "request_id"],
            },
          },
          required: ["error"],
        },
        CreateCard: jsonSchema(createCardBody),
        UpdateCard: jsonSchema(updateCardBody),
        Ingest: jsonSchema(ingestBody),
      },
    },
    paths: {
      "/api/v1/cards": {
        get: {
          summary: "List cards",
          parameters: listParameters,
          responses: {
            "200": cardPageResponse,
            "401": errorResponse,
            "403": errorResponse,
          },
        },
        post: {
          summary: "Create a card on the system Tasks board",
          parameters: [idempotencyHeader],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/CreateCard" } },
            },
          },
          responses: {
            "201": cardResponse,
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
          },
        },
      },
      "/api/v1/cards/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        get: {
          summary: "Read one card",
          responses: {
            "200": cardResponse,
            "401": errorResponse,
            "404": errorResponse,
          },
        },
        patch: {
          summary: "Update a card",
          parameters: [
            {
              name: "If-Match",
              in: "header",
              required: false,
              schema: { type: "string" },
              description: "The `ETag` from a previous read; a mismatch is 412.",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/UpdateCard" } },
            },
          },
          responses: {
            "200": cardResponse,
            "400": errorResponse,
            "404": errorResponse,
            "412": errorResponse,
          },
        },
        delete: {
          summary: "Move a card to the trash",
          responses: { "204": { description: "Deleted" }, "404": errorResponse },
        },
      },
      "/api/v1/ingest": {
        post: {
          summary: "Capture a task with the quick-capture grammar",
          parameters: [idempotencyHeader],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/Ingest" } } },
          },
          responses: {
            "201": { description: "The created card and the parsed fields" },
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
          },
        },
      },
    },
  };
}
