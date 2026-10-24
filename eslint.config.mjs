import { defineConfig } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// eslint-config-next v15 ships legacy eslintrc-style configs (`{ extends: [...] }`),
// so they are converted to flat config with FlatCompat (official ESLint 9 approach).
const compat = new FlatCompat({ baseDirectory: __dirname });

export default defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Layering (SYSTEM_ARCHITECTURE §2): pages/handlers never import repositories
      // or Prisma directly — enforced by review; import-boundary plugin can be added
      // at T-011 follow-up. Keep pragmatic rules here:
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      // App-Router-only project (no pages/ directory); the rule is meaningful only for pages/.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    // Dedicated stdout writers: the structured logger and the CLI validation tool.
    files: ["src/lib/observability/logger.ts", "tools/**"],
    rules: { "no-console": "off" },
  },
  {
    ignores: [".next/**", "node_modules/**", "src/generated/**", "next-env.d.ts"],
  },
]);
