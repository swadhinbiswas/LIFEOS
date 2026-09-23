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
  // ADR-039: raise the auth rate-limit ceiling — the suite signs in several times within one
  // window from a single localhost IP, which Better Auth's per-IP defaults treat as abuse.
  env.AUTH_RATE_LIMIT_MAX = "100";
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

  // drizzle.config.ts resolves DATABASE_URL through src/env.ts, whose loader never
  // overrides an already-set variable — so this migrates the E2E database, not the dev one.
  execSync("pnpm exec drizzle-kit migrate", {
    env: { ...process.env, DATABASE_URL: E2E_DB_URL },
    stdio: "inherit",
  });
}
