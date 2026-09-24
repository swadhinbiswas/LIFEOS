import { createHmac, randomBytes } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { webhook_deliveries, webhooks_out } from "@/server/db/schema";

/**
 * Outgoing webhooks (spec §9.3, ADR-066). `emitEvent` is called from the services that own a write
 * and is **best-effort**: it signs the exact body with HMAC-SHA256, records a delivery row per
 * matching subscription, and never lets a webhook failure break the write.
 */

export const WEBHOOK_EVENTS = [
  "card.created",
  "card.updated",
  "card.moved",
  "card.completed",
  "job.stage_changed",
  "habit.logged",
  "note.created",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type WebhookRow = typeof webhooks_out.$inferSelect;
export type DeliveryRow = typeof webhook_deliveries.$inferSelect;

const parseEvents = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

export function createSecret(): string {
  return randomBytes(24).toString("hex");
}

export const signatureFor = (secret: string, body: string): string =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

export async function createWebhook(
  userId: string,
  input: { url: string; events: string[] },
): Promise<WebhookRow> {
  const [row] = await db
    .insert(webhooks_out)
    .values({
      id: newId(),
      user_id: userId,
      url: input.url.trim(),
      secret: createSecret(),
      events: JSON.stringify(input.events),
    })
    .returning();
  if (!row) throw new Error("webhook insert returned no row");
  return row;
}

export async function listWebhooks(userId: string): Promise<WebhookRow[]> {
  return db
    .select()
    .from(webhooks_out)
    .where(eq(webhooks_out.user_id, userId))
    .orderBy(desc(webhooks_out.created_at));
}

export async function deleteWebhook(userId: string, id: string): Promise<void> {
  await db
    .delete(webhooks_out)
    .where(and(eq(webhooks_out.id, id), eq(webhooks_out.user_id, userId)));
}

export async function listDeliveries(userId: string, limit = 20): Promise<DeliveryRow[]> {
  return db
    .select()
    .from(webhook_deliveries)
    .where(eq(webhook_deliveries.user_id, userId))
    .orderBy(desc(webhook_deliveries.created_at))
    .limit(limit);
}

const ok = (status: number) => status >= 200 && status < 300;

async function deliver(row: WebhookRow, event: string, payload: string): Promise<void> {
  let response_status = 0;
  let error: string | null = null;
  try {
    const response = await fetch(row.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lifeos-event": event,
        "x-lifeos-signature": signatureFor(row.secret, payload),
      },
      body: payload,
      signal: AbortSignal.timeout(5_000),
    });
    response_status = response.status;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  await db.insert(webhook_deliveries).values({
    id: newId(),
    user_id: row.user_id,
    webhook_id: row.id,
    event,
    payload,
    response_status,
    error,
    delivered_at: ok(response_status) ? new Date() : null,
  });
}

/** Sign and deliver to every active subscription for the event. Never throws. */
export async function emitEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const subscriptions = (
      await db
        .select()
        .from(webhooks_out)
        .where(and(eq(webhooks_out.user_id, userId), eq(webhooks_out.active, true)))
    ).filter((row) => parseEvents(row.events).includes(event));
    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({ event, at: new Date().toISOString(), data });
    for (const row of subscriptions) await deliver(row, event, payload);
  } catch (caught) {
    console.error("[webhooks] emit failed", caught);
  }
}

/** Replay one logged delivery's exact payload as a fresh attempt. */
export async function redeliver(userId: string, deliveryId: string): Promise<boolean> {
  const [delivery] = await db
    .select()
    .from(webhook_deliveries)
    .where(and(eq(webhook_deliveries.id, deliveryId), eq(webhook_deliveries.user_id, userId)))
    .limit(1);
  if (!delivery) return false;
  const [row] = await db
    .select()
    .from(webhooks_out)
    .where(and(eq(webhooks_out.id, delivery.webhook_id), eq(webhooks_out.user_id, userId)))
    .limit(1);
  if (!row) return false;
  await deliver(row, delivery.event, delivery.payload);
  return true;
}

export interface WebhookSummary {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}
export const toWebhookSummary = (row: WebhookRow): WebhookSummary => ({
  id: row.id,
  url: row.url,
  events: parseEvents(row.events),
  active: row.active,
  createdAt: new Date(row.created_at).toISOString(),
});

export interface DeliverySummary {
  id: string;
  event: string;
  status: number;
  error: string | null;
  delivered: boolean;
  createdAt: string;
}
export const toDeliverySummary = (row: DeliveryRow): DeliverySummary => ({
  id: row.id,
  event: row.event,
  status: row.response_status,
  error: row.error,
  delivered: Boolean(row.delivered_at),
  createdAt: new Date(row.created_at).toISOString(),
});
