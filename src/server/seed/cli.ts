import { seedDemo } from "./index";

/**
 * `pnpm db:seed [--reset]` (spec §12, ADR-084). Without `--reset` it is idempotent for the sample
 * portfolio and additive for everything else; with `--reset` it deletes the demo account and
 * rebuilds it from scratch.
 *
 * Wrapped in an async main because the project compiles to CommonJS, which has no top-level await.
 */
async function main(): Promise<void> {
  const reset = process.argv.includes("--reset");
  const summary = await seedDemo({ reset });
  console.info(`[seed] demo workspace ${reset ? "reset and " : ""}ready`);
  console.info(`[seed] ${JSON.stringify(summary)}`);
}

main().catch((error: unknown) => {
  console.error("[seed] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
