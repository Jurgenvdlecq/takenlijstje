import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // De systeemsleutel (service role) is alleen toegestaan binnen src/server/system/**
  // (TECHNICAL_DESIGN §5.3)
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/system/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/system/admin-client", "**/system/admin-client", "./admin-client"],
              message: "De service role mag alleen binnen src/server/system/** worden gebruikt (TECHNICAL_DESIGN §5.3).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
