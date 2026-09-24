/**
 * Drizzle schema barrel — one export per table + relations, keyed by table name so the
 * object doubles as Better Auth's adapter `schema` (ADR-036: keys must equal the custom
 * `modelName`s users/sessions/accounts/verifications). Later phases add sibling files
 * (schema/boards.ts, schema/career.ts, …) re-exported here.
 */
export * from "./identity";
export * from "./user-settings";
export * from "./boards";
export * from "./career";
