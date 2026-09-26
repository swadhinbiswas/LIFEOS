import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * Every message exists in both shipped locales (spec §6.1). Nothing enforces this at runtime:
 * `next-intl` renders a missing key as the key itself, so a half-translated string reaches a
 * Bengali-speaking user as `aiLinesCaption` with no error anywhere. This is the test that would
 * have caught it.
 */

const locales = ["en", "bn"] as const;

// The exact parser next-intl uses. Resolved from the installed copy rather than added as a direct
// dependency: this asserts what *this* version accepts, so a different version would be a different
// test, and adding a package to observe someone else's would be the wrong fix.
const require = createRequire(import.meta.url);

const read = (locale: (typeof locales)[number]): unknown =>
  JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")) as unknown;

/** Every dotted message path in the file, depth-first. */
const paths = (value: unknown, prefix = ""): string[] => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    paths(child, prefix === "" ? key : `${prefix}.${key}`),
  );
};

const flatten = (value: unknown, prefix = ""): Map<string, string> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return new Map([[prefix, String(value)]]);
  }
  const out = new Map<string, string>();
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    for (const [path, text] of flatten(child, prefix === "" ? key : `${prefix}.${key}`)) {
      out.set(path, text);
    }
  }
  return out;
};

describe("message catalogues", () => {
  const [en, bn] = locales.map(read);
  const enPaths = new Set(paths(en));
  const bnPaths = new Set(paths(bn));

  it("has the same keys in every locale", () => {
    const missing = locales.map((locale, index) => ({
      locale,
      keys: [...(index === 0 ? bnPaths : enPaths)].filter(
        (key) => !(index === 0 ? enPaths : bnPaths).has(key),
      ),
    }));
    const report = missing
      .filter((entry) => entry.keys.length > 0)
      .map((entry) => `${entry.locale} is missing: ${entry.keys.slice(0, 8).join(", ")}`);
    expect(report).toEqual([]);
  });

  it("keeps the same placeholders in both locales, so a translation cannot drop a value", () => {
    const enFlat = flatten(en);
    const bnFlat = flatten(bn);
    const mismatched: string[] = [];
    for (const [path, text] of enFlat) {
      const placeholders = (value: string) =>
        [...value.matchAll(/\{(\w+)/gu)].map((match) => match[1]).sort();
      if (placeholders(text).join(",") !== placeholders(bnFlat.get(path) ?? "").join(",")) {
        mismatched.push(path);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it("leaves no message empty", () => {
    for (const locale of locales) {
      const blank = [...flatten(read(locale))]
        .filter(([, text]) => text.trim() === "")
        .map(([path]) => path);
      expect({ locale, blank }).toEqual({ locale, blank: [] });
    }
  });
  it("is valid ICU MessageFormat in every locale", () => {
    // The bug this exists for: a message is an ICU MessageFormat template, so a `{` in it opens a
    // placeholder. The OpenCode plugin's install snippet is JSON — nothing but braces — and it
    // shipped as a message, so `/settings/activity` failed to render with `MALFORMED_ARGUMENT` from
    // the parser. A missing key fails loudly and nobody noticed; a malformed one fails at runtime on
    // a real page, which is why it took a browser to find.
    //
    // Every message is parsed, not just the ones with braces: that is the check next-intl performs,
    // so it is the check that has to pass. Code snippets do not belong in a message catalogue at
    // all (ADR-124) — quoting the braces does not make the parser accept them.
    const { parse } = require("@formatjs/icu-messageformat-parser") as {
      parse: (message: string) => unknown;
    };

    for (const locale of locales) {
      const malformed: Array<{ path: string; error: string }> = [];
      for (const [path, text] of flatten(read(locale))) {
        try {
          parse(text);
        } catch (error) {
          malformed.push({ path, error: error instanceof Error ? error.message : String(error) });
        }
      }
      expect({ locale, malformed }).toEqual({ locale, malformed: [] });
    }
  });

  it("is called with every placeholder its message declares", () => {
    // `t("key")` where the message contains `{days}` throws FORMATTING_ERROR at *render* time, so
    // it surfaces as a broken dashboard rather than a type error — which is how two empty-state
    // labels shipped claiming "no coding activity in the last {days} days" with no `days` given.
    //
    // A static scan, because the alternative is waiting for a page to render. The repo already
    // source-scans in `src/lib/forms.test.ts`, so this is the same shape: the compiler cannot see
    // a missing runtime argument, so something has to.
    const sources = globSync("src/**/*.tsx");
    const namespaced = /\b(?:useTranslations|getTranslations)\(\s*"([^"]+)"/gu;
    const bareCall = /\bt\(\s*(['"])([A-Za-z0-9_.\-]+)\1\s*\)/gu;
    const placeholder = /\{(\w+)/gu;

    const lookup = (dotted: string): string | null => {
      let node: unknown = read("en");
      for (const part of dotted.split(".")) {
        if (node === null || typeof node !== "object" || !(part in node)) return null;
        node = (node as Record<string, unknown>)[part];
      }
      return typeof node === "string" ? node : null;
    };

    const omissions: Array<{ file: string; key: string; missing: string[] }> = [];
    for (const file of sources) {
      const src = readFileSync(file, "utf8");
      const namespaces = [...src.matchAll(namespaced)].map((match) => match[1] as string);
      if (namespaces.length === 0) continue;
      for (const call of src.matchAll(bareCall)) {
        const key = call[2] as string;
        for (const namespace of namespaces) {
          const message = lookup(`${namespace}.${key}`);
          if (message === null) continue;
          const needed = [...new Set([...message.matchAll(placeholder)].map((m) => m[1]!))];
          if (needed.length > 0) {
            omissions.push({ file, key, missing: needed });
            break;
          }
        }
      }
    }
    expect(omissions).toEqual([]);
  });
});
