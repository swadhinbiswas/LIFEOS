/**
 * Apply pending migrations before `next dev` starts (ADR-113).
 *
 * A green gate never looks at the developer's own database: the unit tests and the acceptance suite
 * each migrate their own throwaway file, and `pnpm build` only typechecks. So "generate a
 * migration, forget to run it" produced a clean run and a `SQLITE_ERROR: no such table` on the
 * first page that touched the new table. Migrating here makes the two steps impossible to forget.
 *
 * Deliberate limits:
 * - **Local file databases only.** A `libsql://` or `https://` URL is a shared or production
 *   database, and this script has no business writing to it from a developer's `pnpm dev`; those
 *   run migrations through the deploy pipeline instead. `pnpm db:migrate` remains available for
 *   anyone who does mean to.
 * - **Failures are reported, not swallowed.** A migration that cannot apply is a real problem and
 *   the developer should see it, but it is also not a reason to kill the dev server over — the
 *   health probe at `/api/health` reports the drift as not-ready, which is the designed signal.
 * - Nothing is printed on success beyond one line, so the dev output stays readable.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// This script runs *before* Next.js, so nothing has read `.env` yet. Node's built-in loader is
// what `src/env.ts` uses for the same reason (ADR-027); it never overrides a variable already in
// the environment, so an explicit DATABASE_URL still wins.
try {
  process.loadEnvFile();
} catch {
  /* no .env — variables come from the process environment */
}

const url = process.env.DATABASE_URL ?? "";

const isLocalFile = (value) => value.startsWith("file:");

const resolveLocalPath = (value) => {
  const raw = value.slice("file:".length).split("?")[0] ?? "";
  return raw.startsWith("/") ? raw : `${process.cwd()}/${raw}`;
};

if (!url) {
  console.log("[migrate] DATABASE_URL is not set — skipping (set it to auto-migrate on dev)");
} else if (!isLocalFile(url)) {
  console.log(
    "[migrate] DATABASE_URL is not a local file — skipping. Shared and cloud databases are " +
      "migrated by the deploy pipeline; run `pnpm db:migrate` deliberately.",
  );
} else {
  const target = resolveLocalPath(url);
  const parent = target.slice(0, target.lastIndexOf("/"));
  if (parent && !existsSync(parent)) {
    console.log(`[migrate] skipping — ${parent} does not exist yet`);
  } else {
    try {
      // drizzle-kit prints "migrations applied successfully!" whether it applied one migration or
      // none, so the exit code is the only honest signal. Matching the output text would report
      // "up to date" from a string that is also printed when nothing was verified.
      execFileSync("pnpm", ["exec", "drizzle-kit", "migrate"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      console.log("[migrate] migrations are up to date");
    } catch (error) {
      const detail = error instanceof Error ? error.stderr || error.message : String(error);
      console.warn(`[migrate] could not migrate ${target} — continuing.\n${String(detail).trim()}`);
      console.warn("[migrate] /api/health will report not-ready until this is resolved.");
    }
  }
}
