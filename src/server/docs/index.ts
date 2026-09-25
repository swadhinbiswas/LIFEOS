import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The in-app docs site (spec §13, ADR-087). The repository Markdown is the single source — this
 * lists the files and reads them at request time; a file that does not exist yet reports the phase
 * that will write it rather than showing placeholder prose.
 */

export interface DocEntry {
  slug: string;
  title: string;
  /** Path relative to the repository root. */
  path: string;
  /** Which phase writes it, shown when the file is missing. */
  phase: string;
}

export const DOCS: DocEntry[] = [
  { slug: "readme", title: "README", path: "README.md", phase: "Phase 0" },
  { slug: "architecture", title: "Architecture", path: "docs/ARCHITECTURE.md", phase: "Phase 9" },
  { slug: "security", title: "Security", path: "docs/SECURITY.md", phase: "Phase 9" },
  { slug: "self-hosting", title: "Self-hosting", path: "docs/SELF_HOSTING.md", phase: "Phase 9" },
  { slug: "release", title: "Release", path: "docs/RELEASE.md", phase: "Phase 9" },
  { slug: "handoff", title: "Handoff", path: "docs/HANDOFF.md", phase: "Phase 0" },
  { slug: "decisions", title: "Decisions", path: "docs/DECISIONS.md", phase: "Phase 0" },
  { slug: "scope", title: "MVP scope", path: "docs/MVP-SCOPE.md", phase: "Phase 0" },
  { slug: "research", title: "Research", path: "docs/RESEARCH.md", phase: "Phase 0" },
  { slug: "erd", title: "Data model", path: "docs/ERD.md", phase: "Phase 0" },
  { slug: "ingest", title: "Ingest", path: "docs/INGEST.md", phase: "Phase 5" },
];

export function docBySlug(slug: string): DocEntry | null {
  return DOCS.find((entry) => entry.slug === slug) ?? null;
}

/** The file's text, or null when it has not been written yet. */
export async function readDoc(entry: DocEntry): Promise<string | null> {
  try {
    return await readFile(join(process.cwd(), entry.path), "utf8");
  } catch {
    return null;
  }
}

export async function docExists(entry: DocEntry): Promise<boolean> {
  return (await readDoc(entry)) !== null;
}
