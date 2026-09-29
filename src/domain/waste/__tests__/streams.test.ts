import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyStream, normalizePickups, sortStreams } from "../streams";

/**
 * WP3b — afvalsoorten → bakken (TECHNICAL_DESIGN §18.1.4; AC-196).
 * Op de echte P0-fixture (openbaar testadres 2591 BB 87).
 */
const p0 = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../server/waste/__tests__/fixtures/p0-2591BB-87.json", import.meta.url)), "utf8"),
) as { afvalstromen: { id: number; icon: string; title: string; menu_title: string }[] };

describe("classifyStream op de P0-fixture (AC-196)", () => {
  it("5 soorten → rest, papier, pmd en 2× null (GFT en kerstbomen)", () => {
    const perId = Object.fromEntries(p0.afvalstromen.map((s) => [s.title, classifyStream(s)]));
    expect(perId).toEqual({ GFT: null, PMD: "pmd", Papier: "papier", Rest: "rest", Kerstbomen: null });
  });
});

describe("classifyStream — terugval op trefwoorden bij een onbekend icon", () => {
  it.each([
    [{ icon: "nieuw-icoon", title: "Restafval" }, "rest"],
    [{ icon: "nieuw-icoon", title: "Oud papier en karton" }, "papier"],
    [{ icon: null, title: "PMD" }, "pmd"],
    [{ icon: "x", title: "Plastic verpakkingen" }, "pmd"],
    [{ icon: "x", title: "Iets", menu_title: "Rest" }, "rest"],
  ])("%j → %s", (stroom, bak) => {
    expect(classifyStream(stroom)).toBe(bak);
  });

  it.each([
    { icon: "bank", title: "Grofvuil" },
    { icon: "x", title: "GFT-rest" },
    { icon: "x", title: "Kerstbomen en papier" },
    { icon: "x", title: "Textiel" },
    { icon: "x", title: "Onbekende soort" },
  ])("%j → null (geen taak, AC-196)", (stroom) => {
    expect(classifyStream(stroom)).toBeNull();
  });
});

describe("sortStreams en normalizePickups", () => {
  it("vaste volgorde restafval, papier, PMD", () => {
    expect(sortStreams(["pmd", "rest", "papier", "rest"])).toEqual(["rest", "papier", "pmd"]);
  });

  it("datums per bak gesorteerd en ontdubbeld; ontbrekende bak = []", () => {
    expect(normalizePickups({ rest: ["2026-10-13", "2026-10-06", "2026-10-13"] })).toEqual({
      rest: ["2026-10-06", "2026-10-13"],
      papier: [],
      pmd: [],
    });
  });
});
