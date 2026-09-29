import { describe, expect, it } from "vitest";
import {
  candidateLetter,
  formatPostcode,
  formatWasteAddress,
  isStorableSuffix,
  matchCandidate,
  normalizeWasteAddress,
  type AddressCandidate,
} from "../address";

/**
 * WP3b — adres invoeren en kiezen (TECHNICAL_DESIGN §18.1.5; AC-184, AC-185, AC-187).
 */

const ok = (postcode: string, houseNumber: string, suffix: string | null) => {
  const result = normalizeWasteAddress({ postcode, houseNumber, suffix });
  if (!result.ok) throw new Error(`verwacht geldig: ${JSON.stringify(result.errors)}`);
  return result.address;
};
const fouten = (postcode: string, houseNumber: string, suffix: string | null) => {
  const result = normalizeWasteAddress({ postcode, houseNumber, suffix });
  if (result.ok) throw new Error("verwacht ongeldig");
  return result.errors;
};

describe("normalizeWasteAddress — schrijfwijze (AC-187 a/b)", () => {
  it('"2511ab" + "12 a" en "2511 AB" + "12A" geven hetzelfde adres: 2511AB, 12, toevoeging A', () => {
    expect(ok("2511ab", "12 a", null)).toEqual({ postcode: "2511AB", houseNumber: 12, suffix: "A" });
    expect(ok("2511 AB", "12A", null)).toEqual({ postcode: "2511AB", houseNumber: 12, suffix: "A" });
  });

  it.each([
    ["12a", "A"],
    ["12 a", "A"],
    ["12-2", "2"],
    ["12 bis", "BIS"],
  ])('"%s" wordt nummer 12 met toevoeging %s', (invoer, toevoeging) => {
    expect(ok("2511AB", invoer, null)).toEqual({ postcode: "2511AB", houseNumber: 12, suffix: toevoeging });
  });

  it("een ingevulde toevoeging gaat voor op letters achter het nummer, en wordt hoofdletters zonder spatie", () => {
    expect(ok("2511AB", "12", " b ")).toEqual({ postcode: "2511AB", houseNumber: 12, suffix: "B" });
  });

  it('suffix null = niet opgegeven; "" = bewust het adres zonder letter', () => {
    expect(ok("2511AB", "12", null).suffix).toBeNull();
    expect(ok("2511AB", "12", "").suffix).toBe("");
  });

  it("postcode met spaties en kleine letters wordt 2517AB", () => {
    expect(ok(" 2517 ab ", "1", null).postcode).toBe("2517AB");
  });
});

describe("normalizeWasteAddress — ongeldig formaat (AC-184)", () => {
  // "2511 A B" is na het weghalen van spaties wél 4 cijfers + 2 letters (AC-184), dus geldig; een streepje niet
  it.each(["", "0511AB", "251AB", "2511A", "2511ABC", "ABCD12", "2511-AB", "2511AB1"])("postcode %j → veldfout postcode (T-43)", (postcode) => {
    expect(fouten(postcode, "12", null)).toMatchObject({ postcode: true });
  });

  // AC-184: "een getal buiten 1 t/m 99999" → T-44. Let op: "100000" wordt nu nummer 10000 met toevoeging "0"
  // (bevinding test-writer WP3b); deze test faalt tot dat hersteld is.
  it.each(["", "0", "100000", "abc", "-1", "12.5"])("huisnummer %j → veldfout huisnummer (T-44)", (nummer) => {
    expect(fouten("2511AB", nummer, null)).toMatchObject({ houseNumber: true });
  });

  it("grenswaarden 1 en 99999 zijn geldig", () => {
    expect(ok("2511AB", "1", null).houseNumber).toBe(1);
    expect(ok("2511AB", "99999", null).houseNumber).toBe(99_999);
  });

  it("een toevoeging van 5 tekens in het toevoegingsveld → veldfout toevoeging (T-44b)", () => {
    expect(fouten("2511AB", "12", "ABCDE")).toEqual({ suffix: true });
  });

  it("een toevoeging van 4 tekens is geldig", () => {
    expect(ok("2511AB", "12", "abc1").suffix).toBe("ABC1");
  });

  it("een te lange toevoeging achter het nummer → veldfout huisnummer", () => {
    expect(fouten("2511AB", "12 abcde", null)).toEqual({ houseNumber: true });
  });

  it("leeg postcode- én huisnummerveld → beide velden fout", () => {
    expect(fouten("", "", null)).toEqual({ postcode: true, houseNumber: true });
  });
});

describe("formatPostcode / formatWasteAddress (UX §13.16 <adres>)", () => {
  it('"2517AB" → "2517 AB"; adres "2517 AB 12A"', () => {
    expect(formatPostcode("2517AB")).toBe("2517 AB");
    expect(formatWasteAddress("2517AB", 12, "A")).toBe("2517 AB 12A");
    expect(formatWasteAddress("2517AB", 12, "")).toBe("2517 AB 12");
  });
});

describe("matchCandidate — de app kiest nooit zelf (AC-185, AC-187 c)", () => {
  const kaal: AddressCandidate = { bagId: "0518200000000104", letter: "" };
  const a: AddressCandidate = { bagId: "0518200000000105", letter: "A" };
  const b: AddressCandidate = { bagId: "0518200000000106", letter: "B" };

  it("0 kandidaten → not_found (A gaf [])", () => {
    expect(matchCandidate([], null)).toEqual({ kind: "not_found" });
    expect(matchCandidate([], "A")).toEqual({ kind: "not_found" });
  });

  it("geen toevoeging opgegeven en 1 kandidaat → die kandidaat", () => {
    expect(matchCandidate([kaal], null)).toEqual({ kind: "match", candidate: kaal });
  });

  it("geen toevoeging opgegeven en meerdere kandidaten → choose, met alle kandidaten", () => {
    expect(matchCandidate([kaal, a, b], null)).toEqual({ kind: "choose", candidates: [kaal, a, b] });
  });

  it('toevoeging "" = bewust het adres zonder letter → exacte match', () => {
    expect(matchCandidate([kaal, a, b], "")).toEqual({ kind: "match", candidate: kaal });
  });

  it("gegeven toevoeging → exacte match, anders not_found", () => {
    expect(matchCandidate([kaal, a, b], "A")).toEqual({ kind: "match", candidate: a });
    expect(matchCandidate([kaal, a, b], "C")).toEqual({ kind: "not_found" });
    expect(matchCandidate([kaal], "A")).toEqual({ kind: "not_found" });
  });
});

describe("candidateLetter en isStorableSuffix (AC-187; security-review WP3b punt 4)", () => {
  it('huisletter en huisnummerToevoeging "" betekenen "geen": letter ""', () => {
    expect(candidateLetter("", "")).toBe("");
    expect(candidateLetter(null, undefined)).toBe("");
  });

  it("letter + toevoeging worden samengevoegd, in hoofdletters", () => {
    expect(candidateLetter("a", "2")).toBe("A2");
  });

  it("een toevoeging van de bron met meer dan 4 tekens is niet te bewaren", () => {
    expect(isStorableSuffix(candidateLetter("A", "BCDE"))).toBe(false);
    expect(isStorableSuffix(candidateLetter("A", "BCD"))).toBe(true);
    expect(isStorableSuffix("")).toBe(true);
  });
});
