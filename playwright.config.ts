import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. Verwacht een draaiende app (E2E_BASE_URL, standaard
 * http://localhost:3100) met een Supabase-omgeving waarin `npm run seed` is
 * gedraaid. Zie README → "End-to-end tests".
 *
 * Afvalkalender (WP3b): Playwright start altijd de stub van de gemeentebron
 * (tests/e2e/support/waste-stub.mjs, poort E2E_WASTE_STUB_PORT, standaard 4599).
 * De app moet die stub als bron gebruiken: WASTE_SOURCE_BASE_URL=http://127.0.0.1:<poort>.
 * Met E2E_START_APP=1 bouwt en start Playwright de app zelf zo
 * (tests/e2e/support/start-app.sh, poort E2E_APP_PORT).
 */
const stubPort = Number(process.env.E2E_WASTE_STUB_PORT ?? 4599);
const appPort = Number(process.env.E2E_APP_PORT ?? 3100);
const startApp = process.env.E2E_START_APP === "1";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  webServer: [
    {
      command: "node tests/e2e/support/waste-stub.mjs",
      url: `http://127.0.0.1:${stubPort}/__stub/health`,
      reuseExistingServer: true,
      env: { E2E_WASTE_STUB_PORT: String(stubPort) },
    },
    ...(startApp
      ? [
          {
            command: "bash tests/e2e/support/start-app.sh",
            url: `http://localhost:${appPort}/login`,
            reuseExistingServer: true,
            timeout: 300_000,
            env: { E2E_WASTE_STUB_PORT: String(stubPort), E2E_APP_PORT: String(appPort) },
          },
        ]
      : []),
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${appPort}`,
    locale: "nl-NL",
    timezoneId: "Europe/Amsterdam",
    trace: "retain-on-failure",
    ...devices["iPhone 13"],
    browserName: "chromium",
  },
});
