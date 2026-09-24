import { describe, expect, it } from "vitest";

import { parseCapture } from "./parse";

/** Local-time reference so the assertions hold in any test timezone. */
const NOW = new Date(2026, 8, 24, 9, 0, 0); // 24 Sep 2026, 09:00 local

describe("quick-capture grammar (spec 4.3, adr-015)", () => {
  it("parses the documented example: date, tag and priority", () => {
    const parsed = parseCapture("buy milk tomorrow 5pm #home !2", NOW);

    expect(parsed.title).toBe("buy milk");
    expect(parsed.priority).toBe("p2");
    expect(parsed.tags).toEqual(["home"]);
    expect(parsed.dueAt).not.toBeNull();
    expect(parsed.dueAt?.getDate()).toBe(25); // tomorrow, local
    expect(parsed.dueAt?.getHours()).toBe(17); // 5pm
    expect(parsed.uncertain).toEqual([]);
  });

  it("accepts !p0..!p3 as well as bare digits and keeps the rest as the title", () => {
    expect(parseCapture("ship it !p1", NOW).priority).toBe("p1");
    expect(parseCapture("ship it !0", NOW).priority).toBe("p0");
    expect(parseCapture("ship it !p1", NOW).title).toBe("ship it");
    expect(parseCapture("no priority here", NOW).priority).toBeNull();
  });

  it("collects several tags, lower-cased and unique", () => {
    const parsed = parseCapture("plan trip #Travel #travel #2026", NOW);
    expect(parsed.tags).toEqual(["travel", "2026"]);
    expect(parsed.title).toBe("plan trip");
  });

  it("flags a date-only match as uncertain for the preview", () => {
    const parsed = parseCapture("report due friday", NOW);
    expect(parsed.matched).toContain("friday");
    expect(parsed.uncertain).toContain("friday");
    expect(parsed.dueAt).not.toBeNull();
  });

  it("leaves plain text untouched", () => {
    const parsed = parseCapture("just a task", NOW);
    expect(parsed.title).toBe("just a task");
    expect(parsed.dueAt).toBeNull();
    expect(parsed.tags).toEqual([]);
    expect(parsed.matched).toEqual([]);
  });

  it("never invents a date from an empty or token-only capture", () => {
    expect(parseCapture("", NOW).title).toBe("");
    expect(parseCapture("#tag !1", NOW).dueAt).toBeNull();
    expect(parseCapture("#tag !1", NOW).title).toBe("");
  });
});
