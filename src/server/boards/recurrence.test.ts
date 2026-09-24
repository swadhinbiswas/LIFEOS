import { describe, expect, it } from "vitest";

import { isValidRecurrence, nextOccurrence, shiftStart } from "./recurrence";

const at = (iso: string) => new Date(iso);

describe("recurrence helpers (adr-015)", () => {
  it("keeps the card's own time-of-day for the next daily occurrence", () => {
    const due = at("2026-09-24T09:00:00.000Z");
    const next = nextOccurrence("FREQ=DAILY;INTERVAL=1", due, due);
    expect(next?.toISOString()).toBe("2026-09-25T09:00:00.000Z");
  });

  it("respects BYDAY for weekly rules", () => {
    const thursday = at("2026-09-24T09:00:00.000Z");
    const next = nextOccurrence("FREQ=WEEKLY;BYDAY=MO", thursday, thursday);
    expect(next?.getUTCDay()).toBe(1); // Monday
    expect(next?.toISOString()).toBe("2026-09-28T09:00:00.000Z");
  });

  it("skips forward instead of spawning an overdue occurrence after a late completion", () => {
    const due = at("2026-09-20T09:00:00.000Z");
    const now = at("2026-09-24T12:00:00.000Z");
    const next = nextOccurrence("FREQ=DAILY;INTERVAL=1", due, now);
    expect((next?.getTime() ?? 0) > now.getTime()).toBe(true);
    expect(next?.toISOString()).toBe("2026-09-25T09:00:00.000Z");
  });

  it("returns null for rules that cannot be parsed", () => {
    expect(nextOccurrence("not-a-rule", at("2026-09-24T09:00:00.000Z"))).toBeNull();
    expect(isValidRecurrence("FREQ=DAILY")).toBe(true);
    expect(isValidRecurrence("nonsense")).toBe(false);
  });

  it("preserves the lead time between start and due", () => {
    const start = at("2026-09-23T09:00:00.000Z");
    const due = at("2026-09-24T09:00:00.000Z");
    const next = at("2026-09-25T09:00:00.000Z");
    expect(shiftStart(start, due, next)?.toISOString()).toBe("2026-09-24T09:00:00.000Z");
    expect(shiftStart(null, due, next)).toBeNull();
  });
});
