import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * No page may hardcode its document title again (ADR-072 follow-up). `export const metadata = {
 * title: "Dashboard" }` compiles, ships, and silently leaves the browser tab English on a Bangla
 * page — it fails in production and never in CI, because the catalogue is not consulted.
 *
 * This walks the route tree so a new page cannot reintroduce it. `src/app` is small enough to glob
 * synchronously, and the rule is a grep either way.
 */

const pageFiles = globSync("src/app/**/page.tsx");

describe("route metadata", () => {
  it("finds the pages to check", () => {
    expect(pageFiles.length).toBeGreaterThan(30);
  });

  it("never hardcodes a title literal", () => {
    const offenders: string[] = [];
    for (const file of pageFiles) {
      const source = readFileSync(file, "utf8");
      // A literal `metadata = { title: "..." }` or a static `title: "..."` inside a metadata export.
      if (/export const metadata[^=]*=\s*\{[^}]*title:\s*["'`]/.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses generateMetadata, so the catalogue is the only source of a title", () => {
    const offenders: string[] = [];
    for (const file of pageFiles) {
      const source = readFileSync(file, "utf8");
      if (!/export const metadata\b/.test(source)) continue;
      // The one legitimate exception: the landing page sets `title.absolute` to the product name,
      // which is identical in every locale and must not take the root layout's `%s · Name` template.
      if (/title:\s*\{\s*absolute:/.test(source)) continue;
      offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
