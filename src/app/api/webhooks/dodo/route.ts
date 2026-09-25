import { env } from "@/env";
import { verifyDodoWebhook } from "@/server/billing/dodo";
import { applyBillingEvent } from "@/server/billing/events";

/**
 * Dodo webhook receiver (spec §11, ADR-081). 404 without a webhook secret; signature-verified on the
 * **raw** body; idempotent on the Standard Webhooks `webhook-id`, so a replay returns 200 and changes
 * nothing. Errors are deliberately coarse — no detail leaks about why a signature failed.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!env.DODO_PAYMENTS_WEBHOOK_KEY) return new Response(null, { status: 404 });

  const rawBody = await request.text();
  const eventId = request.headers.get("webhook-id") ?? "";
  const payload = verifyDodoWebhook(rawBody, {
    "webhook-id": eventId,
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
  });

  if (!payload || eventId === "") {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  const result = await applyBillingEvent({
    eventId,
    type: payload.type ?? "unknown",
    businessId: payload.business_id ?? null,
    payload,
  });

  return Response.json({ received: true, duplicate: result.duplicate });
}
