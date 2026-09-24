import { describe, expect, it } from "vitest";

import { escapeCsvValue, toCsv } from "./csv";

describe("csv export (spec 6.1)", () => {
  it("quoting: plain values stay bare, awkward ones are quoted and doubled", () => {
    expect(escapeCsvValue("plain")).toBe("plain");
    expect(escapeCsvValue("has, comma")).toBe('"has, comma"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue("line\nbreak")).toBe('"line\nbreak"');
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
    expect(escapeCsvValue(42)).toBe("42");
  });

  it("writes a header and one row per record, in the given column order", () => {
    const csv = toCsv(
      [
        { title: "first", priority: "p0" },
        { title: "second, with comma", priority: null },
      ],
      ["title", "priority"],
    );
    expect(csv).toBe('title,priority\nfirst,p0\n"second, with comma",\n');
  });

  it("formats dates as ISO instants", () => {
    const csv = toCsv([{ due: new Date("2026-09-24T09:00:00.000Z") }], ["due"]);
    expect(csv).toBe("due\n2026-09-24T09:00:00.000Z\n");
  });
});
