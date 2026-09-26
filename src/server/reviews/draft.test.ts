import { describe, expect, it } from "vitest";

import { isUsableDraft, parseDraft } from "./draft";

/**
 * The draft parser (ADR-116). This is the boundary where a model's formatting decisions meet three
 * textareas, and a parser that quietly returns the whole blob into the first field is worse than
 * one that refuses: the user would see a filled form that is obviously wrong and have to clear it.
 */
describe("parseDraft", () => {
  const wellFormed = [
    "WINS:",
    "shipped the payments fix",
    "cut the p95 from 900ms to 240ms",
    "LESSONS:",
    "left the migration until the last day",
    "NEXT:",
    "finish the follow-ups before Friday",
  ].join("\n");

  it("splits the three answers on their markers", () => {
    expect(parseDraft(wellFormed)).toEqual({
      wins: "shipped the payments fix\ncut the p95 from 900ms to 240ms",
      lessons: "left the migration until the last day",
      next: "finish the follow-ups before Friday",
    });
  });

  it("tolerates a model that writes the marker and its text on one line", () => {
    const draft = parseDraft("WINS: a\nLESSONS: b\nNEXT: c");
    expect(draft).toEqual({ wins: "a", lessons: "b", next: "c" });
  });

  it("is case-insensitive, because a model will not always shout", () => {
    expect(parseDraft("wins:\na\nlessons:\nb\nnext:\nc").wins).toBe("a");
  });

  it("does not let one answer swallow the rest when a marker is missing", () => {
    // The important case: without a `NEXT:` marker the naive `.*` would put everything into `wins`
    // and the user would save a review with the same paragraph three times.
    const draft = parseDraft("WINS:\nshipped a thing\nLESSONS:\nran late");
    expect(draft.wins).toBe("shipped a thing");
    expect(draft.lessons).toBe("ran late");
    expect(draft.next).toBe("");
    expect(isUsableDraft(draft)).toBe(false);
  });

  it("refuses a draft that is really the whole answer in one field", () => {
    expect(isUsableDraft(parseDraft("I had a good week overall and here is why"))).toBe(false);
  });

  it("strips blank lines and stray whitespace, so the textarea is not padded", () => {
    const draft = parseDraft("WINS:\n\n  a  \n\n\n  b\n\nLESSONS:\nc\nNEXT:\nd");
    expect(draft.wins).toBe("a\nb");
  });

  it("reports a model that ignored the format as unusable rather than as a draft", () => {
    for (const text of ["", "   \n  ", "no markers here at all"]) {
      expect(isUsableDraft(parseDraft(text)), text).toBe(false);
    }
  });
});

describe("parseDraft preamble and repetition", () => {
  it("drops text before the first marker, so a chatty model cannot become the first answer", () => {
    // Without this, a model that opens with "Sure — here's your week:" would save that sentence as
    // the wins, which is the failure a user notices first and trusts least.
    const draft = parseDraft("Sure! Here is your week:\nWINS:\nshipped a\nLESSONS:\nb\nNEXT:\nc");
    expect(draft.wins).toBe("shipped a");
  });

  it("keeps the last answer when a marker is repeated, not both copies", () => {
    // Models restate the format before answering. Appending would leave two paragraphs in the
    // textarea; the user would have to notice and delete one.
    const draft = parseDraft("WINS:\nfirst attempt\nWINS:\nsecond attempt\nLESSONS:\nb\nNEXT:\nc");
    expect(draft.wins).toBe("second attempt");
  });

  it("handles CRLF line endings, which a model can emit", () => {
    expect(parseDraft("WINS:\r\na\r\nLESSONS:\r\nb\r\nNEXT:\r\nc").wins).toBe("a");
  });
});
