import { createHmac, randomBytes } from "node:crypto";

import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";

import { newId } from "@/lib/id";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "@/server/ai/crypto";
import { db } from "@/server/db";
import { webhook_deliveries, webhooks_out } from "@/server/db/schema";

/**
 * Outgoing webhooks (spec §9.3, ADR-066/069). `emitEvent` is called from the services that own a
 * write and is **best-effort**: it signs the exact body with HMAC-SHA256, records a delivery row per
 * matching subscription, and never lets a webhook failure break the write.
 *
 * Delivery is retried on a schedule: a failed attempt records `next_attempt_at` computed from an
 * exponential backoff, and the retry sweep (`retryDueDeliveries`, called by the cron route or
 * opportunistically by the UI) re-attempts due rows in place until they succeed or are exhausted.
 */

export const WEBHOOK_EVENTS = [
  "card.created",
  "card.updated",
  "card.moved",
  "card.completed",
  "job.stage_changed",
  "habit.logged",
  "note.created",
  // A promise kept or made, so an external system can keep a CRM in step with the people queue.
  "contact.follow_up_changed",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type WebhookRow = typeof webhooks_out.$inferSelect;
export type DeliveryRow = typeof webhook_deliveries.$inferSelect;

/** Exponential backoff between attempts, in seconds (ADR-069). */
export const RETRY_BACKOFF_SECONDS = [60, 300, 1_800, 7_200, 21_600] as const;
/** First attempt plus one per backoff step; beyond this a delivery is abandoned (no next retry). */
export const MAX_ATTEMPTS = RETRY_BACKOFF_SECONDS.length + 1;

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

/** Secrets are encrypted at rest (ADR-074 helper); old plaintext rows still verify. */
const secretFor = (stored: string): string => {
  try {
    return decryptSecret(stored);
  } catch {
    return stored;
  }
};

export const signatureFor = (secret: string, body: string): string =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

/** The instant of the next retry after `attempts` attempts, or null once exhausted. */
export const nextAttemptAt = (attempts: number, now: Date): Date | null =>
  attempts >= MAX_ATTEMPTS
    ? null
    : new Date(now.getTime() + (RETRY_BACKOFF_SECONDS[attempts - 1] ?? 21_600) * 1_000);

export async function createWebhook(
  userId: string,
  input: { url: string; events: string[] },
): Promise<WebhookRow> {
  const secret = createSecret();
  const [row] = await db
    .insert(webhooks_out)
    .values({
      id: newId(),
      user_id: userId,
      url: input.url.trim(),
      // Encrypted at rest (ADR-074/083); shown once in plaintext to the caller that created it.
      secret: isEncryptionConfigured() ? encryptSecret(secret) : secret,
      events: JSON.stringify(input.events),
    })
    .returning();
  if (!row) throw new Error("webhook insert returned no row");
  return { ...row, secret };
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

const succeeded = (status: number) => status >= 200 && status < 300;

async function attempt(
  row: WebhookRow,
  event: string,
  payload: string,
): Promise<{ status: number; error: string | null }> {
  try {
    const response = await fetch(row.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lifeos-event": event,
        "x-lifeos-signature": signatureFor(secretFor(row.secret), payload),
      },
      body: payload,
      signal: AbortSignal.timeout(5_000),
    });
    return { status: response.status, error: null };
  } catch (caught) {
    return { status: 0, error: caught instanceof Error ? caught.message : String(caught) };
  }
}

/** First attempt: always logs a delivery, scheduling a retry when it fails. */
async function deliver(row: WebhookRow, event: string, payload: string): Promise<void> {
  const now = new Date();
  const { status, error } = await attempt(row, event, payload);
  const ok = succeeded(status);
  await db.insert(webhook_deliveries).values({
    id: newId(),
    user_id: row.user_id,
    webhook_id: row.id,
    event,
    payload,
    response_status: status,
    error,
    attempts: 1,
    delivered_at: ok ? now : null,
    next_attempt_at: ok ? null : nextAttemptAt(1, now),
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

/** Re-attempt one logged delivery in place, advancing its attempts and backoff. */
export async function retryDelivery(userId: string, deliveryId: string): Promise<boolean> {
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

  const now = new Date();
  const { status, error } = await attempt(row, delivery.event, delivery.payload);
  const ok = succeeded(status);
  const attempts = delivery.attempts + 1;
  await db
    .update(webhook_deliveries)
    .set({
      response_status: status,
      error,
      attempts,
      delivered_at: ok ? now : null,
      next_attempt_at: ok ? null : nextAttemptAt(attempts, now),
    })
    .where(and(eq(webhook_deliveries.id, delivery.id), eq(webhook_deliveries.user_id, userId)));
  return true;
}

/**
 * Retry every due, undelivered delivery (optionally scoped to one user). A null `next_attempt_at`
 * on an undelivered row means it is exhausted, so the `lte` predicate excludes it. Returns how many
 * were attempted.
 */
export async function retryDueDeliveries(now: Date = new Date(), userId?: string): Promise<number> {
  const filters = [
    isNull(webhook_deliveries.delivered_at),
    lte(webhook_deliveries.next_attempt_at, now),
  ];
  if (userId) filters.push(eq(webhook_deliveries.user_id, userId));

  const due = await db
    .select({ id: webhook_deliveries.id, userId: webhook_deliveries.user_id })
    .from(webhook_deliveries)
    .where(and(...filters))
    .orderBy(asc(webhook_deliveries.next_attempt_at))
    .limit(100);

  let count = 0;
  for (const row of due) {
    await retryDelivery(row.userId, row.id);
    count += 1;
  }
  return count;
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
  attempts: number;
  nextAttemptAt: string | null;
  createdAt: string;
}
export const toDeliverySummary = (row: DeliveryRow): DeliverySummary => ({
  id: row.id,
  event: row.event,
  status: row.response_status,
  error: row.error,
  delivered: Boolean(row.delivered_at),
  attempts: row.attempts,
  nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
});
