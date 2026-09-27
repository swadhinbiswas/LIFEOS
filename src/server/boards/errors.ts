/**
 * The board engine's error type (ADR-042).
 *
 * It lives here rather than in `index.ts` so the engine's own modules — `checklists.ts`,
 * `views.ts`, `trash.ts` — can throw it without importing the module that imports them. A cycle
 * would work (the binding is only read at call time) but every reader would have to prove that.
 */

export type BoardErrorCode = "not_found" | "conflict" | "invalid";

export class BoardError extends Error {
  constructor(
    readonly code: BoardErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BoardError";
  }
}
