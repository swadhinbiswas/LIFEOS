import DodoPayments from "dodopayments";

import { billingReady, dodoEnvironment, env } from "@/env";

/**
 * Dodo Payments client and webhook verification (spec §11, ADR-013/081). The client is built only
 * when a key is configured; `verifyDodoWebhook` needs the webhook secret and returns `null` for any
 * missing secret, bad signature or malformed body — the route turns that into a 401.
 *
 * SDK docs (fetched 2026-09-25): `client.webhooks.unwrap(rawBody, { headers })` with the Standard
 * Webhooks `webhook-id` / `webhook-signature` / `webhook-timestamp` headers.
 */

export interface DodoWebhookPayload {
  business_id?: string;
  type?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}

function client(): DodoPayments | null {
  if (!env.DODO_PAYMENTS_API_KEY && !env.DODO_PAYMENTS_WEBHOOK_KEY) return null;
  return new DodoPayments({
    // The SDK requires a bearer token even to construct; `unwrap` never calls the API, so when only
    // a webhook secret is configured a placeholder is safe (verification stays local).
    bearerToken: env.DODO_PAYMENTS_API_KEY ?? "webhook-verification-only",
    environment: dodoEnvironment,
    ...(env.DODO_PAYMENTS_WEBHOOK_KEY ? { webhookKey: env.DODO_PAYMENTS_WEBHOOK_KEY } : {}),
  });
}

/** Checkout and portal are only offered when billing is ready; verification also needs the secret. */
export function dodoIsReady(): boolean {
  return billingReady;
}

export function verifyDodoWebhook(
  rawBody: string,
  headers: { "webhook-id": string; "webhook-signature": string; "webhook-timestamp": string },
): DodoWebhookPayload | null {
  if (!env.DODO_PAYMENTS_WEBHOOK_KEY || !headers["webhook-id"] || !headers["webhook-signature"]) {
    return null;
  }
  const dodo = client();
  if (!dodo) return null;
  try {
    return dodo.webhooks.unwrap(rawBody, { headers }) as unknown as DodoWebhookPayload;
  } catch {
    return null;
  }
}

/** Product id for a paid plan, or null when the operator has not configured one. */
export function productIdFor(plan: "pro" | "team"): string | null {
  return plan === "team" ? (env.DODO_PRODUCT_TEAM ?? null) : (env.DODO_PRODUCT_PRO ?? null);
}

export const dodoReturnUrl = env.DODO_PAYMENTS_RETURN_URL ?? null;
