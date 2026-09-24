import { describe, expect, it } from "vitest";

import { goalProgress, keyResultProgress, linkedProgress } from "./progress";

describe("goal progress (spec 6.4)", () => {
  it("scales numeric key results against their target", () => {
    expect(keyResultProgress({ kind: "number", current: 4, target: 8 })).toBe(50);
    expect(keyResultProgress({ kind: "number", current: 12, target: 8 })).toBe(100);
    expect(keyResultProgress({ kind: "number", current: 0, target: 0 })).toBe(0);
    expect(keyResultProgress({ kind: "number", current: 1, target: 0 })).toBe(100);
  });

  it("treats percent key results as already computed", () => {
    expect(keyResultProgress({ kind: "percent", current: 40, target: 100 })).toBe(40);
    expect(keyResultProgress({ kind: "percent", current: 140, target: 100 })).toBe(100);
  });

  it("uses linked progress for linked key results", () => {
    expect(keyResultProgress({ kind: "linked", current: 0, target: 0 }, 75)).toBe(75);
    expect(keyResultProgress({ kind: "linked", current: 0, target: 0 })).toBe(0);
  });

  it("computes linked progress from the entities, never from a guess", () => {
    expect(linkedProgress([])).toBe(0);
    expect(
      linkedProgress([
        { kind: "card", done: true },
        { kind: "card", done: false },
        { kind: "habit", done: true },
      ]),
    ).toBe(67);
    expect(linkedProgress([{ kind: "habit", done: true }])).toBe(100);
  });

  it("averages key results into objective progress", () => {
    expect(goalProgress([])).toBe(0);
    expect(goalProgress([50, 100, 0])).toBe(50);
    expect(goalProgress([100, 100])).toBe(100);
  });
});
