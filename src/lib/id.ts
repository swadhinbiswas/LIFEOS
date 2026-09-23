import { ulid } from "ulid";

/**
 * Every LifeOS identifier (ADR-008): 26-char Crockford base32 ULID, time-sortable, so
 * cursor pagination on (user_id, created_at, id) needs no secondary index (ERD §0).
 * This is the single generator — Better Auth's `advanced.database.generateId` calls it
 * too (ADR-036).
 */
export function newId(): string {
  return ulid();
}
