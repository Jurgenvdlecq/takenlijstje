/**
 * Integratietests (TECHNICAL_DESIGN §13, laag "Integratie"): services en de tick
 * tegen de LOKALE teststack (tests/e2e/support/local-stack.sh), nooit productie.
 * Draaien vanuit de projectmap: npx vitest run -c tests/integration/vitest.config.mts
 * De sleutels komen uit tests/e2e/support/keys.mjs (lokaal JWT-geheim) en worden
 * niet afgedrukt.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../..", import.meta.url));
const url = process.env.INTEGRATION_SUPABASE_URL ?? "http://127.0.0.1:54321";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error(`Integratietests weigeren een database buiten de lokale stack: ${url}`);
}

const keys = Object.fromEntries(
  execFileSync("node", ["tests/e2e/support/keys.mjs"], { encoding: "utf8", cwd: root })
    .trim()
    .split("\n")
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

export default defineConfig({
  root,
  resolve: {
    alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    // Eén database: de bestanden na elkaar, zodat ticks elkaar niet storen
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: keys.SUPABASE_SERVICE_ROLE_KEY,
      // Nep-VAPID: web-push is in de tests gemockt, er gaat niets naar een pushdienst
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-vapid-publiek",
      VAPID_PRIVATE_KEY: "test-vapid-prive",
      VAPID_SUBJECT: "mailto:test@example.com",
    },
  },
});
