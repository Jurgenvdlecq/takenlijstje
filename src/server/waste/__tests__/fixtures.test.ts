import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * De P0-fixture is een ongewijzigde kopie van de probe-uitkomst van 2026-09-29
 * (fixtures/README.md). De tests van WP3b bouwen erop; verandert hij, dan
 * bewijzen ze niets meer over de echte bron.
 */
const hier = (pad: string) => fileURLToPath(new URL(pad, import.meta.url));

describe("fixture p0-2591BB-87.json", () => {
  it("is byte-voor-byte gelijk aan docs/wijzigingen/W-03/probe/fixtures-2591BB-87.json", () => {
    const probe = hier("../../../../docs/wijzigingen/W-03/probe/fixtures-2591BB-87.json");
    if (!existsSync(probe)) return; // de probe-map is niet in elke checkout aanwezig
    const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
    expect(hash(hier("./fixtures/p0-2591BB-87.json"))).toBe(hash(probe));
  });

  it("bevat alleen het openbare testadres en geen content of icon_data", () => {
    const tekst = readFileSync(hier("./fixtures/p0-2591BB-87.json"), "utf8");
    expect(tekst).toContain("2591BB");
    expect(tekst).not.toMatch(/"content"|"icon_data"/);
    expect(tekst).not.toMatch(/Jurgen|Ellen|Lynn|Kai/);
  });
});
