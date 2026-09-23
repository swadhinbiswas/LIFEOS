import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

export default defineConfig([
  globalIgnores([
    "**/.next/**",
    "**/node_modules/**",
    "**/coverage/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "drizzle/**",
    ".data/**",
  ]),
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    rules: {
      // spec §13 definition of done: no unexplained any
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
]);
