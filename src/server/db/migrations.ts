import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { sql } from "drizzle-orm";

import { db } from "@/server/db";

/**
 * Is the connected database at the latest migration? (ADR-113)
 *
 * This exists because a green gate once sat next to a crashing dev server. The unit tests and the
 * acceptance suite each migrate their **own** throwaway database, and `pnpm build` only typechecks,
 * so nothing in CI ever looks at the developer's `.data/lifeos.db`. Adding a migration and
 * forgetting `pnpm db:migrate` therefore produced a perfectly green run and a runtime
 * `SQLITE_ERROR: no such table` on the first page that touched the new table.
 *
 * The count comes from `drizzle/meta/_journal.json`, **not** from a directory listing of `.sql`
 * files, because that journal is what `drizzle-kit migrate` actually replays. A `.sql` file that
 * was never entered in the journal is silently ignored by the migrator, so counting files would
 * both over-report drift and miss the case that matters; those orphans are reported separately.
 */

const MIGRATIONS_DIR = "drizzle";
const JOURNAL = join(MIGRATIONS_DIR, "meta", "_journal.json");

export interface MigrationDrift {
  /** Entries in the drizzle journal — the migrations the migrator will replay. */
  expected: number;
  /** Migrations the database says it has applied. */
  applied: number;
  /** Journal entries the database has not applied. Zero when current. */
  pending: number;
  /** The newest journal tag, for the operator's benefit. */
  latest: string | null;
  /**
   * `.sql` files present but absent from the journal. These are **never applied**, so a schema
   * that only exists in one of them will crash at runtime no matter how many times you migrate.
   */
  orphans: string[];
  /** True when the journal could not be read, e.g. a trimmed serverless bundle. */
  unknown: boolean;
}

interface Journal {
  entries?: Array<{ idx: number; tag: string }>;
}

const readJournal = (): { expected: number; latest: string | null } | null => {
  try {
    const parsed = JSON.parse(readFileSync(JOURNAL, "utf8")) as Journal;
    const entries = parsed.entries ?? [];
    const newest = entries.at(-1)?.tag ?? null;
    return { expected: entries.length, latest: newest === null ? null : `${newest}.sql` };
  } catch {
    return null;
  }
};

const readOrphans = (expected: number): string[] => {
  try {
    const journaled = new Set<string>();
    const parsed = JSON.parse(readFileSync(JOURNAL, "utf8")) as Journal;
    for (const entry of parsed.entries ?? []) journaled.add(`${entry.tag}.sql`);

    return (
      readdirSync(MIGRATIONS_DIR)
        .filter((name) => name.endsWith(".sql"))
        .filter((name) => !journaled.has(name))
        .sort()
        // Defensive: a count mismatch alone is worth reporting, not enumerating 16 false positives.
        .slice(0, expected + 8)
    );
  } catch {
    return [];
  }
};

/** The drift between the committed migrations and the connected database. Never throws. */
export async function migrationDrift(): Promise<MigrationDrift> {
  const journal = readJournal();

  if (journal === null) {
    // A bundle without ./drizzle was built from the current schema, so it is not "behind" —
    // claiming 0 pending here is accurate, and `unknown` keeps the health probe honest about why.
    return { expected: 0, applied: 0, pending: 0, latest: null, orphans: [], unknown: true };
  }

  const orphans = readOrphans(journal.expected);

  let applied: number;
  try {
    const rows = await db.all<{ n: number }>(sql`select count(*) as n from __drizzle_migrations`);
    applied = Number(rows[0]?.n ?? 0);
  } catch {
    // No journal table at all: the database has never been migrated, which is the most behind a
    // database can be. Report every expected migration as outstanding rather than a silent 0/0.
    return {
      expected: journal.expected,
      applied: 0,
      pending: journal.expected,
      latest: journal.latest,
      orphans,
      unknown: false,
    };
  }

  return {
    expected: journal.expected,
    applied,
    // Applied can legitimately exceed expected (a database migrated from a branch whose migration
    // was later reverted), so only the shortfall counts.
    pending: Math.max(0, journal.expected - applied),
    latest: journal.latest,
    orphans,
    unknown: false,
  };
}

/** One line an operator can act on, or null when the database is current. */
export const driftMessage = (drift: MigrationDrift): string | null => {
  const problems: string[] = [];
  if (drift.pending > 0) {
    problems.push(
      `${drift.pending} migration(s) not applied — run \`pnpm db:migrate\` (latest: ${drift.latest ?? "unknown"})`,
    );
  }
  if (drift.orphans.length > 0) {
    problems.push(
      `${drift.orphans.length} migration file(s) missing from drizzle/meta/_journal.json and never applied: ${drift.orphans.join(", ")} — regenerate with \`pnpm db:generate\``,
    );
  }
  return problems.length === 0 ? null : problems.join("; ");
};
