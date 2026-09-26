import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Isolated E2E database (ADR-029): rebuilt from ./drizzle before every run. */
export const E2E_DB_URL = "file:tests/e2e/.e2e.db";

/**
 * Environment for the spawned web server: the caller's env with DATABASE_URL forced to
 * the isolated file. Undefined-valued variables are dropped so the result is a plain
 * record Playwright's `webServer.env` accepts.
 */
export function e2eEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  env.DATABASE_URL = E2E_DB_URL;
  // Hermetic like the DB: force the in-memory Redis stub (ADR-021) so an acceptance run never
  // reads or writes a real Upstash database, whatever a developer has in .env.
  env.UPSTASH_REDIS_REST_URL = "";
  env.UPSTASH_REDIS_REST_TOKEN = "";
  // Same reasoning for Turso, and it is not optional. `src/env.ts` *rejects* TURSO_AUTH_TOKEN
  // alongside a `file:` URL, and this function sets exactly that URL above. The token reaches the
  // test server either way — copied from the runner's environment, or loaded from `.env` by
  // `next start` — so without this line a developer pointing the app at Turso makes the whole
  // acceptance suite fail to boot, and the error names a variable most contributors have never
  // heard of. A remote database must be unreachable from a test run.
  //
  // Empty string, NOT `delete`, and the distinction is the whole fix. `delete` only removes the key
  // from the object handed to Playwright; the web server is `pnpm build && next start`, and Next
  // loads `.env` itself, so the token is put straight back and validation fails again. An empty
  // string survives that load, and `configuredEnv()` in `env.ts` treats empty as "not configured".
  env.TURSO_AUTH_TOKEN = "";
  // ADR-039: raise the auth rate-limit ceiling — the suite signs in several times within one
  // window from a single localhost IP, which Better Auth's per-IP defaults treat as abuse.
  env.AUTH_RATE_LIMIT_MAX = "100";
  // AI copilot (ADR-074/075/076): a fixed at-rest key, a fixed approval-signing secret, and the
  // deterministic scripted model, so the acceptance run needs no paid provider key.
  env.AI_ENCRYPTION_KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
  env.TOOL_APPROVAL_SECRET = "e2e-tool-approval-secret-0000000000";
  env.AI_SCRIPTED = "true";
  // Guards the cron routes; set so the proactive cron can be exercised end to end.
  env.CRON_SECRET = "e2e-cron-secret-000000000000";
  return env;
}

export default function globalSetup(): void {
  const dbFile = join(process.cwd(), "tests", "e2e", ".e2e.db");
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    rmSync(`${dbFile}${suffix}`, { force: true });
  }

  // The dev file-outbox (ADR-022) is the E2E mailbox — empty it so mail from an earlier
  // run can never satisfy an assertion.
  const outbox = join(process.cwd(), ".data", "outbox");
  rmSync(outbox, { recursive: true, force: true });
  mkdirSync(outbox, { recursive: true });

  // Every child process that ends up importing `src/env` needs the same pair: a local DATABASE_URL
  // and no Turso token. `src/env.ts` rejects that combination outright, and its loader refills the
  // token from `.env` for any variable that is not already set — so the token has to be blanked
  // here as well, not just in the web server's environment. One helper so the three call sites
  // cannot drift apart again, which is how this was missed twice.
  const childEnv = { ...process.env, DATABASE_URL: E2E_DB_URL, TURSO_AUTH_TOKEN: "" };

  // drizzle.config.ts resolves DATABASE_URL through src/env.ts, whose loader never
  // overrides an already-set variable — so this migrates the E2E database, not the dev one.
  execSync("pnpm exec drizzle-kit migrate", { env: childEnv, stdio: "inherit" });

  // Seed the public demo workspace so /demo shows real sample data (spec §12, ADR-084).
  execSync("pnpm db:seed -- --reset", { env: childEnv, stdio: "inherit" });
}
