/** @vitest-environment node */
import { rmSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

// ADR-029: this integration file owns its own database; unique per process.
const DB_FILE = `.data/billing-int-${process.pid}`;
process.env.DATABASE_URL = `file:${DB_FILE}.db`;
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${DB_FILE}.db${suffix}`, { force: true });
}

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("@/server/db");
const { billing_events, users } = await import("@/server/db/schema");
const { applyBillingEvent, billingEventCount } = await import("./events");
const { getSubscription } = await import("./subscriptions");

const USER = "01HBILL000000000000000000001";

const subscriptionActive = (id: string) => ({
  type: "subscription.active",
  businessId: "biz_test",
  payload: {
    business_id: "biz_test",
    type: "subscription.active",
    timestamp: "2026-09-25T10:00:00Z",
    data: {
      payload_type: "Subscription",
      subscription_id: "sub_test_1",
      customer_id: "cus_test_1",
      metadata: { userId: USER, plan: "pro" },
      next_billing_date: "2026-10-25T10:00:00Z",
    },
  },
  eventId: id,
});

describe("billing webhook processing (spec §11, adr-081)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values({
      id: USER,
      email: "billing@example.test",
      name: "Billing",
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it("applies a subscription and is a no-op on replay", async () => {
    const first = await applyBillingEvent(subscriptionActive("msg_1"));
    expect(first).toEqual({ duplicate: false, applied: true, userId: USER });

    const subscription = await getSubscription(USER);
    expect(subscription).toMatchObject({
      plan: "pro",
      status: "active",
      providerSubscriptionId: "sub_test_1",
    });

    // The exact same delivery again: nothing new is written, nothing changes.
    const replay = await applyBillingEvent(subscriptionActive("msg_1"));
    expect(replay.duplicate).toBe(true);
    expect(replay.applied).toBe(false);
    expect(await billingEventCount()).toBe(1);
    expect((await getSubscription(USER))?.status).toBe("active");
  });

  it("records an event it cannot attribute, without changing a subscription", async () => {
    const result = await applyBillingEvent({
      eventId: "msg_2",
      type: "payment.succeeded",
      payload: { type: "payment.succeeded", data: { payment_id: "pay_1" } },
    });
    expect(result).toEqual({ duplicate: false, applied: false, userId: null });
    expect(await billingEventCount()).toBe(2);

    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(billing_events)
      .where(eq(billing_events.event_id, "msg_2"));
    expect(row?.type).toBe("payment.succeeded");
  });

  it("reflects cancellation", async () => {
    await applyBillingEvent({
      eventId: "msg_3",
      type: "subscription.cancelled",
      payload: {
        type: "subscription.cancelled",
        data: { metadata: { userId: USER, plan: "pro" }, subscription_id: "sub_test_1" },
      },
    });
    expect((await getSubscription(USER))?.status).toBe("cancelled");
  });
});
