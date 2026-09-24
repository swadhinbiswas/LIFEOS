import { findToolSpec } from "./tools/catalog";

/**
 * The single approval policy for AI tool calls (spec §8, ADR-076).
 *
 * The chat route passes this into the AI SDK's `toolApproval`. It is pure and deterministic so it
 * can be unit-tested without a model, and it fails **closed**: an unknown tool is denied, a
 * destructive tool can never be auto-approved, and only a tool explicitly marked auto-approvable
 * can be downgraded to `approved` by the user's allowlist.
 *
 * Return shape matches the AI SDK's statuses; `approved` means "run without asking".
 */
export type ApprovalDecision =
  "not-applicable" | "approved" | "user-approval" | { type: "denied"; reason: string };

export function approvalFor(toolName: string, autoApprove: readonly string[]): ApprovalDecision {
  const spec = findToolSpec(toolName);
  if (!spec) return { type: "denied", reason: `unknown tool: ${toolName}` };

  if (spec.risk === "read") return "not-applicable";
  if (spec.risk === "destructive") return "user-approval"; // never auto-approvable

  return spec.autoApprovable === true && autoApprove.includes(toolName)
    ? "approved"
    : "user-approval";
}
