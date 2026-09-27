import { execSync } from "node:child_process";

/** Met E2E_RESEED=1 wordt het demohuishouden voor iedere run opnieuw aangemaakt. */
export default function globalSetup() {
  if (process.env.E2E_RESEED === "1") {
    execSync("npx tsx scripts/seed.ts --reset", { stdio: "inherit" });
  }
}
