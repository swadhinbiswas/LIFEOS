import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Every message exists in both shipped locales (spec §6.1). Nothing enforces this at runtime:
 * `next-intl` renders a missing key as the key itself, so a half-translated string reaches a
 * Bengali-speaking user as `aiLinesCaption` with no error anywhere. This is the test that would
 * have caught it.
 */

const locales = ["en", "bn"] as const;

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
});
