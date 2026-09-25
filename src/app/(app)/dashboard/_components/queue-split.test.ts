import { describe, expect, it } from "vitest";

import { partitionQueue } from "./queue-split";

const card = (id: string) => ({ id });

describe("partitionQueue (ADR-101)", () => {
  it("keeps the slices disjoint so the bar cannot double-count", () => {
    // "c1" is in both the inbox and due-today lists; it must be counted once.
    const partition = partitionQueue({
      overdue: [card("o1")],
      dueToday: [card("c1"), card("c2")],
      inbox: [card("c1"), card("i1")],
      openCards: 6,
    });

    expect(partition.slices).toEqual([
      { id: "overdue", count: 1 },
      { id: "dueToday", count: 2 },
      { id: "inbox", count: 1 },
      { id: "open", count: 2 },
    ]);
    expect(partition.slices.reduce((sum, slice) => sum + slice.count, 0)).toBe(partition.total);
  });

  it("never reports a negative remainder when the brief lists exceed openCards", () => {
    const partition = partitionQueue({
      overdue: [card("o1"), card("o2")],
      dueToday: [],
      inbox: [],
      openCards: 1,
    });

    expect(partition.slices.find((slice) => slice.id === "open")?.count).toBe(0);
    expect(partition.total).toBe(2);
  });

  it("is empty for a user with no open cards", () => {
    const partition = partitionQueue({ overdue: [], dueToday: [], inbox: [], openCards: 0 });
    expect(partition.total).toBe(0);
  });
});
