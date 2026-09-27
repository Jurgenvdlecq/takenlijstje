import { describe, expect, it } from "vitest";
import { guessCategory, parseShoppingInput, rankSuggestions } from "./parse";

describe("parseShoppingInput", () => {
  it.each([
    ["2 melk", "Melk", "2"],
    ["2x melk", "Melk", "2"],
    ["melk 2x", "Melk", "2"],
    ["melk x2", "Melk", "2"],
    ["melk 2", "Melk", "2"],
    ["1 kg appels", "Appels", "1 kg"],
    ["1,5 kg aardappels", "Aardappels", "1,5 kg"],
    ["3 pakken melk", "Melk", "3 pakken"],
    ["500g gehakt", "Gehakt", "500 g"],
    ["gehakt 500 gram", "Gehakt", "500 gram"],
    ["cola 2 flessen", "Cola", "2 flessen"],
    ["  Halfvolle   melk  ", "Halfvolle melk", null],
    ["brood", "Brood", null],
    ["7up", "7up", null],
  ])("%s", (input, name, quantity) => {
    expect(parseShoppingInput(input)).toEqual({ name, quantity });
  });

  it("lege invoer", () => {
    expect(parseShoppingInput("   ")).toEqual({ name: "", quantity: null });
  });

  it("een getal met een woord dat geen eenheid is hoort bij de naam", () => {
    expect(parseShoppingInput("2 grote tomaten")).toEqual({ name: "Grote tomaten", quantity: "2" });
  });
});

describe("guessCategory", () => {
  it.each([
    ["Melk", "dairy"],
    ["Jonge kaas", "dairy"],
    ["Griekse yoghurt", "dairy"],
    ["Volkorenbrood", "bread"],
    ["Croissants", "bread"],
    ["Cola zero", "drinks"],
    ["Bier", "drinks"],
    ["Appelsap", "drinks"],
    ["Water", "drinks"],
    ["Appels", "produce"],
    ["Bananen", "produce"],
    ["Tomaten", "produce"],
    ["IJsbergsla", "produce"],
    ["Kipfilet", "meat"],
    ["Rundergehakt", "meat"],
    ["Vis", "meat"],
    ["Vanille-ijs", "frozen"],
    ["Diepvriespizza", "frozen"],
    ["Pizza", "frozen"],
    ["Shampoo", "drugstore"],
    ["Tandpasta", "drugstore"],
    ["Zeep", "drugstore"],
    ["Toiletpapier", "household"],
    ["Afwasmiddel", "household"],
    ["Wasmiddel", "household"],
    ["Vuilniszakken", "household"],
    ["Rijst", "other"],
    ["Hagelslag", "other"],
    ["Fruit", "produce"],
    ["Uien", "produce"],
    ["Batterijen AA", "household"],
    ["Iets onbekends", "other"],
    ["", "other"],
  ])("%s → %s", (name, category) => {
    expect(guessCategory(name)).toBe(category);
  });
});

describe("rankSuggestions", () => {
  const history = [
    { name: "Melk", category: "dairy" as const },
    { name: "brood", category: "bread" as const },
    { name: "melk", category: "dairy" as const },
    { name: "Bananen", category: "produce" as const },
    { name: "Brood", category: "bread" as const },
    { name: "Melk ", category: "dairy" as const },
    { name: "Kaas", category: "dairy" as const },
  ];

  it("telt per naam (hoofdletterongevoelig), vaakst eerst", () => {
    expect(rankSuggestions(history, [])).toEqual([
      { name: "Melk", category: "dairy", count: 3 },
      { name: "brood", category: "bread", count: 2 },
      { name: "Bananen", category: "produce", count: 1 },
      { name: "Kaas", category: "dairy", count: 1 },
    ]);
  });

  it("laat weg wat al op de lijst staat", () => {
    expect(rankSuggestions(history, ["MELK", "kaas"]).map((s) => s.name)).toEqual(["brood", "Bananen"]);
  });

  it("respecteert de limiet", () => {
    expect(rankSuggestions(history, [], 2)).toHaveLength(2);
  });
});
