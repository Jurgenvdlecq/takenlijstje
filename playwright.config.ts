import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. Verwacht een draaiende app (E2E_BASE_URL, standaard
 * http://localhost:3100) met een Supabase-omgeving waarin `npm run seed` is
 * gedraaid. Zie README → "End-to-end tests".
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    locale: "nl-NL",
    timezoneId: "Europe/Amsterdam",
    trace: "retain-on-failure",
    ...devices["iPhone 13"],
    browserName: "chromium",
  },
});
