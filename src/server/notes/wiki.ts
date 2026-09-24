/**
 * Wiki-link parsing (spec §6.5): `[[Note title]]` in a body becomes an edge in `note_links`.
 * Pure so the parsing rules are testable, and deliberately conservative — anything that is not
 * a clean `[[...]]` pair is left as plain text rather than guessed at.
 */

const WIKI_LINK = /\[\[([^\]\n]{1,200})\]\]/g;

/** Unique titles in order of first appearance; whitespace trimmed, empties dropped. */
export function extractWikiLinks(body: string): string[] {
  const titles: string[] = [];
  for (const match of body.matchAll(WIKI_LINK)) {
    const title = match[1]?.trim();
    if (!title) continue;
    if (!titles.includes(title)) titles.push(title);
  }
  return titles;
}

/** The plain text of a note, for search excerpts and previews. */
export function toPlainText(body: string): string {
  return body
    .replace(WIKI_LINK, "$1")
    .replace(/[#*_`>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
