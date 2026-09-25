import { CustomerPortal } from "@dodopayments/nextjs";
import type { NextRequest } from "next/server";

import { env } from "@/env";
import { getServerSession } from "@/server/auth/session";
import { dodoIsReady } from "@/server/billing/dodo";
import { getSubscription } from "@/server/billing/subscriptions";

/**
 * Customer portal (spec §11, ADR-013/082): 404 unless billing is ready, 401 without a session, and
 * 400 until the signed-in user actually has a Dodo customer. The `customer_id` is taken from our
 * own subscription row, never from the query string.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!dodoIsReady()) return new Response(null, { status: 404 });

  const session = await getServerSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const subscription = await getSubscription(session.user.id);
  if (!subscription?.providerCustomerId) {
    return Response.json({ error: "no billing customer yet" }, { status: 400 });
  }

  const handler = CustomerPortal({
    bearerToken: env.DODO_PAYMENTS_API_KEY,
    environment: env.DODO_PAYMENTS_ENVIRONMENT,
  });

  const url = new URL(request.url);
  url.searchParams.set("customer_id", subscription.providerCustomerId);

  return handler(new Request(url, { method: "GET" }) as unknown as NextRequest);
}
