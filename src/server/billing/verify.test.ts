/** @vitest-environment node */
import { describe, expect, it } from "vitest";

// Set before importing the module: env.ts freezes process.env at import (ADR-027).
process.env.DODO_PAYMENTS_WEBHOOK_KEY = `whsec_${Buffer.from("lifeos-test-webhook-secret").toString("base64")}`;

const { verifyDodoWebhook } = await import("./dodo");
const { Webhook } = await import("standardwebhooks");

const SECRET = process.env.DODO_PAYMENTS_WEBHOOK_KEY!;
const BODY = JSON.stringify({
  type: "subscription.active",
  data: { payload_type: "Subscription", metadata: { userId: "u1", plan: "pro" } },
});

function signed(body: string) {
  const webhook = new Webhook(SECRET);
  const id = "msg_test_1";
  const timestamp = new Date();
  const signature = webhook.sign(id, timestamp, body);
  return {
    "webhook-id": id,
    "webhook-signature": signature,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
  };
}

/** Spec §11/ADR-081: a valid signature verifies, a tampered body does not. */
describe("Dodo webhook verification (adr-081)", () => {
  it("accepts a correctly signed body", () => {
    const payload = verifyDodoWebhook(BODY, signed(BODY));
    expect(payload?.type).toBe("subscription.active");
  });

  it("rejects a body that changed after signing", () => {
    const headers = signed(BODY);
    const tampered = BODY.replace('"pro"', '"team"');
    expect(verifyDodoWebhook(tampered, headers)).toBeNull();
  });

  it("rejects a missing signature", () => {
    expect(
      verifyDodoWebhook(BODY, {
        "webhook-id": "msg_1",
        "webhook-signature": "",
        "webhook-timestamp": "0",
      }),
    ).toBeNull();
  });
});
