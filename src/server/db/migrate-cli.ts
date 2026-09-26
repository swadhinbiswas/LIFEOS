import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import { env } from "@/env";

/**
 * `pnpm db:migrate` — apply the committed journal to whatever `DATABASE_URL` points at, local file
 * or remote Turso.
 *
 * This replaces `drizzle-kit migrate` for *applying* migrations, and the reason is measured rather
 * than preferred (ADR-121):
 *
 * - `drizzle-kit migrate` succeeds against a local file database and **fails against Turso** — and
 *   it fails with `exit 1` and no message at all, the spinner overwriting whatever it printed. A
 *   migration step that cannot report why it failed is unusable for the one database that actually
 *   needs migrating, and the failure is indistinguishable from a typo in a config path.
 * - `drizzle-orm/libsql/migrator` is the migrator drizzle-kit itself calls, driven directly. It
 *   applies the identical `./drizzle` journal and was verified to succeed against both a local file
 *   and the remote database.
 *
 * `pnpm db:generate` is still drizzle-kit: producing a migration is a local authoring operation
 * that never touches a database, and it works.
 *
 * Remote writes are deliberate and loud. `scripts/dev-migrate.mjs` skips `libsql://` and `https://`
 * URLs on purpose (ADR-113) so a developer's `pnpm dev` can never migrate a shared database by
 * accident; this command is the sanctioned way to do it on purpose, so it prints the host it is
 * about to write to before it writes.
 *
 * Wrapped in an async main because the project compiles to CommonJS, which has no top-level await.
 */
async function main(): Promise<void> {
  const url = env.DATABASE_URL;
  const remote = !url.startsWith("file:");

  // The host is printed, never the token: that separation is the reason TURSO_AUTH_TOKEN exists as
  // its own variable (ADR-121), and it is what makes this output safe to paste into a runbook.
  const target = url.startsWith("file:") ? url : url.replace(/\/\/.*@/u, "//");
  console.info(`[migrate] target ${target}${remote ? " (remote)" : " (local file)"}`);
  if (remote && !env.TURSO_AUTH_TOKEN) {
    // Not fatal on its own: a token can legitimately be embedded in the URL as `?authToken=`.
    console.info("[migrate] no TURSO_AUTH_TOKEN set; relying on the URL");
  }

  const client = createClient({
    url,
    ...(env.TURSO_AUTH_TOKEN ? { authToken: env.TURSO_AUTH_TOKEN } : {}),
  });

  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  } catch (error: unknown) {
    // The whole reason this script exists: drizzle-kit swallowed this message.
    console.error("[migrate] failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const count = async (sql: string): Promise<number> => {
    try {
      const result = await client.execute(sql);
      return Number(result.rows[0]?.n ?? 0);
    } catch {
      return 0;
    }
  };
  const migrations = await count("select count(*) as n from __drizzle_migrations");
  const tables = await count("select count(*) as n from sqlite_master where type = 'table'");
  console.info(`[migrate] up to date - ${migrations} migrations, ${tables} tables`);
}

main().catch((error: unknown) => {
  console.error("[migrate] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
