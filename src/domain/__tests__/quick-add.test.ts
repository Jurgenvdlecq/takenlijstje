import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "../quick-add/parser";

const members = [
  { id: "j", displayName: "Jurgen" },
  { id: "e", displayName: "Ellen" },
  { id: "l", displayName: "Lynn" },
  { id: "k", displayName: "Kai" },
];
const templates = [
  { id: "t-bath", title: "Badkamer schoonmaken", keywords: ["badkamer", "douche"] },
  { id: "t-wc", title: "WC schoonmaken", keywords: ["wc", "toilet"] },
  { id: "t-groc", title: "Boodschappen doen", keywords: ["boodschappen"] },
];
const today = "2026-09-27"; // zondag
const parse = (text: string) => parseQuickAdd(text, { today, members, templates });

describe("snelle invoer", () => {
  it("Badkamer zaterdag Jurgen", () => {
    expect(parse("Badkamer zaterdag Jurgen")).toMatchObject({
      title: "Badkamer schoonmaken",
      templateId: "t-bath",
      date: "2026-10-03",
      memberId: "j",
    });
  });

  it("vandaag, morgen, korte weekdag en tijd", () => {
    expect(parse("wc morgen ellen")).toMatchObject({ title: "WC schoonmaken", date: "2026-09-28", memberId: "e" });
    expect(parse("Boodschappen za om 10:00")).toMatchObject({ date: "2026-10-03", time: "10:00" });
    expect(parse("Plantjes water geven vandaag 18u")).toMatchObject({ title: "Plantjes water geven", date: today, time: "18:00" });
    expect(parse("zondag stofzuigen")).toMatchObject({ date: today, title: "Stofzuigen" });
    expect(parse("volgende zondag stofzuigen")).toMatchObject({ date: "2026-10-04" });
  });

  it("datums met dag en maand", () => {
    expect(parse("Tandarts 12-10 Kai")).toMatchObject({ date: "2026-10-12", memberId: "k", title: "Tandarts" });
    expect(parse("Ramen wassen 3 okt")).toMatchObject({ date: "2026-10-03" });
    expect(parse("Kerstboom 1-1")).toMatchObject({ date: "2027-01-01" });
  });

  it("herhaling en prioriteit", () => {
    expect(parse("Vaatwasser uitruimen dagelijks").rule).toEqual({ freq: "daily", interval: 1 });
    expect(parse("Badkamer elke zaterdag").rule).toEqual({ freq: "weekly", interval: 1, weekdays: [6] });
    expect(parse("Bed verschonen elke 2 weken zondag").rule).toMatchObject({ freq: "weekly", interval: 2 });
    expect(parse("Belastingaangifte urgent").priority).toBe("urgent");
  });

  it("voor/@ persoon en onbekende woorden blijven in de titel", () => {
    expect(parse("Fiets repareren voor @lynn")).toMatchObject({ title: "Fiets repareren", memberId: "l" });
    expect(parse("Kastje ophangen")).toMatchObject({ title: "Kastje ophangen", templateId: null, date: null, memberId: null });
  });
});
