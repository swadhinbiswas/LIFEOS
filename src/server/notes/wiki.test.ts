import { describe, expect, it } from "vitest";

import { extractWikiLinks, toPlainText } from "./wiki";

describe("wiki links (spec 6.5)", () => {
  it("extracts unique titles in order of appearance", () => {
    expect(extractWikiLinks("see [[Phase 4]] and [[Notes]] and [[Phase 4]]")).toEqual([
      "Phase 4",
      "Notes",
    ]);
  });

  it("ignores malformed or empty pairs", () => {
    expect(extractWikiLinks("[[ ]] [[ok]] [[unclosed [[a\nb]]")).toEqual(["ok"]);
    expect(extractWikiLinks("no links here")).toEqual([]);
  });

  it("turns a note into plain text for excerpts", () => {
    expect(toPlainText("# Heading\n\nsee [[Phase 4]] for *details*")).toBe(
      "Heading see Phase 4 for details",
    );
  });
});
