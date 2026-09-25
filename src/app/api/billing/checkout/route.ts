import { Checkout } from "@dodopayments/nextjs";
import type { NextRequest } from "next/server";

import { env } from "@/env";
import { getServerSession } from "@/server/auth/session";
import { dodoIsReady, dodoReturnUrl, productIdFor } from "@/server/billing/dodo";

/**
 * Billing checkout (spec §11, ADR-013/082). Hidden (404) unless billing is ready, so no one can
 * start a checkout in this release. The session body is rebuilt **server-side** so `metadata.userId`
 * — which attributes the resulting subscription — can never be set by the client.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!dodoIsReady()) return new Response(null, { status: 404 });

  const session = await getServerSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan === "team" ? "team" : "pro";
  const productId = productIdFor(plan);
  if (!productId) {
    return Response.json({ error: "that plan is not available yet" }, { status: 400 });
  }

  const handler = Checkout({
    bearerToken: env.DODO_PAYMENTS_API_KEY,
    ...(dodoReturnUrl ? { returnUrl: dodoReturnUrl } : {}),
    environment: env.DODO_PAYMENTS_ENVIRONMENT,
    type: "session",
  });

  const forwarded = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: session.user.email, name: session.user.name },
      ...(dodoReturnUrl ? { return_url: dodoReturnUrl } : {}),
      metadata: { userId: session.user.id, plan },
    }),
  });

  return handler(forwarded as unknown as NextRequest);
}
