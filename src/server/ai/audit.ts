import { desc, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { audit_log } from "@/server/db/schema";

/**
 * The audit trail (spec §7.3/§8, ADR-073). The copilot writes `actor = "ai"` rows for every tool
 * call it makes; the same table is meant for REST/MCP in Phase 7. Detail is small and free of
 * secrets — never store a provider key or a full note body here.
 */

export interface AuditInput {
  actor: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: unknown;
}

export async function writeAudit(userId: string, input: AuditInput): Promise<void> {
  await db.insert(audit_log).values({
    id: newId(),
    user_id: userId,
    actor: input.actor,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    detail: input.detail === undefined ? null : JSON.stringify(input.detail),
  });
}

export interface AuditRow {
  id: string;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: string | null;
  created_at: Date;
}

/** Newest first, tenant-scoped. */
export async function listAudit(userId: string, limit = 50): Promise<AuditRow[]> {
  return db
    .select({
      id: audit_log.id,
      actor: audit_log.actor,
      action: audit_log.action,
      target_type: audit_log.target_type,
      target_id: audit_log.target_id,
      detail: audit_log.detail,
      created_at: audit_log.created_at,
    })
    .from(audit_log)
    .where(eq(audit_log.user_id, userId))
    .orderBy(desc(audit_log.created_at))
    .limit(limit);
}
