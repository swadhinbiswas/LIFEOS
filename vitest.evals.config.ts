import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * The AI eval suite (spec §8, ADR-078): run with `pnpm eval`. Kept apart from the unit-test config
 * because it is a measurement, not a unit test — it can be run on demand in CI and prints its
 * thresholds.
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.test.ts"],
  },
});
