import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The landing page's terminal transcript must match the CLI (ADR-133).
 *
 * This is a source-level guard rather than a behavioural one, and deliberately so. The alternative —
 * running the CLI against a live API and diffing stdout — needs a server, a key and a fixture account,
 * which is why the transcript was invented in the first place: nothing cheap was checking it.
 *
 * So it checks the thing that is actually authoritative and is already in the repository: the format
 * strings in `src/cli/index.ts`. Each assertion below names a format the CLI really emits, and the
 * transcript is asserted to contain it. Change a `console.info` in the CLI and this fails; change the
 * landing page and it fails. The two cannot drift without one of them being wrong.
 *
 * The failure this exists to prevent: the transcript claimed a tick and an arrow where `add` prints
 * `added:`, reported "focus 25:00" from a command that has no way to know it, and put a tick on
 * `moved` — none of it producible by the program it was attributed to.
 */
const cli = readFileSync("src/cli/index.ts", "utf8");
const landing = readFileSync("src/app/page.tsx", "utf8");

/** The lines between `const HERO_LINES = [` and its closing `];`. */
const transcript = (() => {
  const start = landing.indexOf("const HERO_LINES = [");
  if (start === -1) throw new Error("HERO_LINES not found on the landing page");
  const end = landing.indexOf("];", start);
  return landing.slice(start, end);
})();

describe("the landing page terminal is a real transcript (adr-133)", () => {
  it("quotes commands the CLI's own usage() lists", () => {
    // The three commands in the transcript must be the three `usage()` advertises, so the landing
    // page cannot show a command that does not exist and the usage cannot hide one that does.
    // The usage block uses single-quoted strings, so the double quotes inside are literal.
    expect(cli).toContain('lifeos add "<text>"');
    expect(cli).toContain("lifeos today  ");
    expect(cli).toContain("lifeos jobs move <id> <stage>");
    expect(transcript).toContain("lifeos add ");
    expect(transcript).toContain("lifeos today");
    expect(transcript).toContain("lifeos jobs move ");
  });

  it("shows `add`'s real output format", () => {
    // The CLI prints `added: ${card.title}${due}` — no tick, no arrow, and a due suffix only when
    // there is a date. The example avoids a relative date so the line is true whenever it is read.
    expect(cli).toContain("`added: ${card.title}${due}`");
    expect(transcript).toContain("added: tail the failing cron test");
    expect(transcript).not.toMatch(/✓|✗|→.*career/);
  });

  it("shows `today`'s real per-card lines, and claims nothing it cannot know", () => {
    // One line per card, `!` for overdue. There is no focus total anywhere in the CLI, and the old
    // transcript invented "focus 25:00" from a command that never reads a timer.
    // `${overdue ? "!" : "-"} ${card.title}${overdue ? "  (overdue)" : ""}` — one line per card.
    expect(cli).toContain('${overdue ? "!" : "-"}');
    expect(cli).toContain('"  (overdue)"');
    expect(transcript).toContain("! reply to the Northwind recruiter  (overdue)");
    expect(transcript).not.toMatch(/focus \d|due today ·/);
  });

  it("shows `jobs move`'s real output, id and all", () => {
    // `moved ${applicationId} → ${stage}` — the id it was given, and the stage echoed exactly as
    // typed. The old transcript passed "acme" where the CLI wants an id and added a tick.
    expect(cli).toContain("`moved ${applicationId} → ${stage}`");
    expect(transcript).toMatch(/moved \S+ → interview/);
  });

  it("uses no glyphs the CLI does not print", () => {
    // A ✓ anywhere in the transcript is a line the program cannot produce.
    expect(transcript).not.toContain("✓");
  });
});
