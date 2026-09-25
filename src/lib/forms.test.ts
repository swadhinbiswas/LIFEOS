/** @vitest-environment node */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression guard (security): a `<form>` without a `method` submits as **GET**, which appends every
 * field — including passwords — to the URL, where it lands in browser history, server logs and the
 * `Referer` header. Every form in the app must declare a method; the notes search is the only
 * deliberate `get`, and it carries no secret.
 */
const FORM_RE = /<form\b[^>]*>/gs;

function tsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(path, found);
    else if (entry.name.endsWith(".tsx")) found.push(path);
  }
  return found;
}

const files = tsxFiles(join(process.cwd(), "src"));

describe("forms never default to GET", () => {
  it("every <form> in src declares a method", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const tag of source.match(FORM_RE) ?? []) {
        if (!/\bmethod="/.test(tag)) offenders.push(`${file}: ${tag.slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the only GET form is the notes search", () => {
    const gets: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const tag of source.match(FORM_RE) ?? []) {
        if (/method="get"/.test(tag)) gets.push(file.replace(`${process.cwd()}/`, ""));
      }
    }
    expect(gets).toEqual(["src/app/(app)/notes/page.tsx"]);
  });
});
