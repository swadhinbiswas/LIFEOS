import { beforeEach, describe, expect, it } from "vitest";

import { clearQueue, enqueue, flushCaptureQueue, getPendingCount, getQueue } from "./capture-queue";

describe("offline capture queue (mvp #29, adr-051)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearQueue();
  });

  it("queues captures and persists them to storage", () => {
    enqueue({ text: "buy milk", columnName: "Inbox" });
    enqueue({ text: "call the bank tomorrow", columnName: "Today" });

    expect(getPendingCount()).toBe(2);
    const stored = JSON.parse(
      window.localStorage.getItem("lifeos.capture-queue") ?? "[]",
    ) as Array<{
      text: string;
    }>;
    expect(stored.map((item) => item.text)).toEqual(["buy milk", "call the bank tomorrow"]);
  });

  it("flushes oldest-first and empties the queue", async () => {
    enqueue({ text: "first", columnName: "Inbox" });
    enqueue({ text: "second", columnName: "Inbox" });

    const sent: string[] = [];
    const count = await flushCaptureQueue(async (item) => {
      sent.push(item.text);
      return true;
    });

    expect(count).toBe(2);
    expect(sent).toEqual(["first", "second"]);
    expect(getPendingCount()).toBe(0);
  });

  it("stops at the first failure so the remainder survives", async () => {
    enqueue({ text: "first", columnName: "Inbox" });
    enqueue({ text: "second", columnName: "Inbox" });

    const count = await flushCaptureQueue(async (item) => item.text !== "second");

    expect(count).toBe(1);
    expect(getQueue().map((item) => item.text)).toEqual(["second"]);
  });
});
