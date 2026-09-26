/** @vitest-environment node */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { transform } from "lightningcss";
import { describe, expect, it } from "vitest";

/**
 * Every stylesheet must compile (ADR-127).
 *
 * This exists because a real one shipped. A comment block in `globals.css` was split in two by an
 * edit whose anchor matched the rule instead of the comment, leaving seven lines of prose sitting at
 * the top level of the stylesheet. Every check in the routine gate passed anyway:
 *
 * - the edit reported success, because the replace *did* match — just not where it was meant to;
 * - `prettier --check` does not reformat comment prose, so it had nothing to say;
 * - `pnpm build` printed "Compiled successfully" in 2.2s, which was a warm cache and not a compile;
 * - the existing `globals.css` assertions read the file as a **string**, and `toContain` succeeds
 *   happily on a stylesheet that cannot be parsed by anything.
 *
 * So the file was only ever validated as text. This validates it as CSS, with the compiler Next
 * actually uses. `postcss.parse` is not sufficient — it accepted the broken file, because PostCSS
 * tolerates stray top-level nodes where lightningcss rejects them. Depending on lightningcss
 * directly (rather than relying on Next's transitive copy) is the point: if a future Next swaps
 * compilers, this pin makes the assumption visible instead of quietly testing the wrong parser.
 */
function stylesheets(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...stylesheets(path));
    else if (path.endsWith(".css")) found.push(path);
  }
  return found;
}

describe("stylesheets compile", () => {
  const files = stylesheets(join(__dirname));

  it("finds the stylesheets to check", () => {
    // A glob that silently matches nothing is a test that passes forever.
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file.replace(`${__dirname}/`, "")} parses`, () => {
      const code = readFileSync(file);
      expect(() => transform({ filename: file, code, minify: false })).not.toThrow();
    });
  }
});
