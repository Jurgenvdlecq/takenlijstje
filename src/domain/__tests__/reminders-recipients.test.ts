import { describe, expect, it } from "vitest";
import { PREFERENCE_FOR_TYPE, recipientsFor } from "../reminders";
import type { MemberRow, NotificationType, PreferencesRow } from "@/types/database";

/**
 * WP2a — ontvangers van meldingen (TECHNICAL_DESIGN §6.1, §3.3; AC-073, V-23, V-38a).
 * Gezin uit de voorbeelddata: Jurgen en Ellen (beheerder), Lynn (gezinslid),
 * Kai (uitgezet). Een lid zonder account kan sinds WP2b (…_210, user_id not null)
 * niet meer in de database staan; recipientsFor blijft er defensief tegen bestand.
 */
type Member = Pick<MemberRow, "id" | "user_id" | "is_active">;
type Prefs = Partial<PreferencesRow> & { member_id: string };

const jurgen: Member = { id: "jurgen", user_id: "u-jurgen", is_active: true };
const ellen: Member = { id: "ellen", user_id: "u-ellen", is_active: true };
const lynn: Member = { id: "lynn", user_id: "u-lynn", is_active: true };
const kai: Member = { id: "kai", user_id: "u-kai", is_active: false };
// Oud lid zonder account (vóór WP2b mogelijk; nu uitgesloten door de database): user_id null
const oma: Member = { id: "oma", user_id: null as unknown as string, is_active: true };

const alles: Member[] = [jurgen, ellen, lynn, kai, oma];

function prefs(memberId: string, on: boolean): Prefs {
  return {
    member_id: memberId,
    notify_reminders: on,
    notify_deadline_soon: on,
    notify_overdue: on,
    notify_task_completed: on,
    daily_summary_enabled: on,
    evening_summary_enabled: on,
  };
}

describe("recipientsFor — 'taak gedaan' (AC-073, V-38a)", () => {
  // Ellen en Jurgen hebben "taak gedaan" aan, Lynn uit, Kai is uitgezet (wel aan), oma heeft geen account (wel aan)
  const voorkeuren = [prefs("jurgen", true), prefs("ellen", true), prefs("lynn", false), prefs("kai", true), prefs("oma", true)];

  it("gaat naar ieder actief lid met account dat hem aan heeft: Jurgen en Ellen", () => {
    expect(recipientsFor("task_completed", alles, voorkeuren).sort()).toEqual(["ellen", "jurgen"]);
  });

  it("heeft geen parameter voor wie afvinkte: de ontvangers zijn gelijk, wie het ook deed", () => {
    // De functie neemt precies drie argumenten; een vierde (de afvinker) bestaat niet.
    expect(recipientsFor.length).toBe(3);
    const naEllen = recipientsFor("task_completed", alles, voorkeuren);
    const naJurgen = recipientsFor("task_completed", alles, voorkeuren);
    expect(naEllen).toEqual(naJurgen);
    // wie afvinkte staat er dus zelf ook in
    expect(naEllen).toContain("ellen");
    expect(naJurgen).toContain("jurgen");
  });

  it("Lynn met de voorkeur uit krijgt niets", () => {
    expect(recipientsFor("task_completed", alles, voorkeuren)).not.toContain("lynn");
  });

  it("een uitgezet lid krijgt niets, ook met de voorkeur aan (V-29)", () => {
    expect(recipientsFor("task_completed", alles, voorkeuren)).not.toContain("kai");
  });

  it("een lid zonder account krijgt niets, ook met de voorkeur aan", () => {
    expect(recipientsFor("task_completed", alles, voorkeuren)).not.toContain("oma");
  });

  it("zonder voorkeursrij geldt 'uit'", () => {
    expect(recipientsFor("task_completed", [jurgen, ellen], [prefs("jurgen", true)])).toEqual(["jurgen"]);
  });

  it("niemand met de voorkeur aan → geen ontvangers", () => {
    expect(recipientsFor("task_completed", alles, alles.map((m) => prefs(m.id, false)))).toEqual([]);
  });
});

describe("recipientsFor — elke soort volgt de eigen voorkeur (V-23)", () => {
  const types = Object.keys(PREFERENCE_FOR_TYPE) as Exclude<NotificationType, "waste_sync_failed">[];

  it("kent geen vervallen soorten meer (toewijzen, ruilen)", () => {
    expect(types.sort()).toEqual(
      ["daily_summary", "deadline_soon", "evening_summary", "overdue", "reminder", "task_completed"].sort(),
    );
  });

  it.each(types)("%s: alleen wie precies die voorkeur aan heeft", (type) => {
    const key = PREFERENCE_FOR_TYPE[type];
    const alleenDeze: Prefs = { ...prefs("lynn", false), [key]: true };
    const allesBehalveDeze: Prefs = { ...prefs("ellen", true), [key]: false };
    expect(recipientsFor(type, [lynn, ellen], [alleenDeze, allesBehalveDeze])).toEqual(["lynn"]);
  });
});

describe("recipientsFor — storing van de afvalkalender (W-03, §18.9.3; AC-205)", () => {
  type MetRol = Member & { role: MemberRow["role"] };
  const jurgenA: MetRol = { ...jurgen, role: "admin" };
  const ellenA: MetRol = { ...ellen, role: "admin" };
  const lynnM: MetRol = { ...lynn, role: "member" };
  const kaiA: MetRol = { ...kai, role: "admin" };
  const omaA: MetRol = { ...oma, role: "admin" };
  const gezin = [jurgenA, ellenA, lynnM, kaiA, omaA];

  it("gaat naar iedere actieve beheerder met account, los van de voorkeuren: Jurgen en Ellen", () => {
    expect(recipientsFor("waste_sync_failed", gezin, gezin.map((m) => prefs(m.id, false))).sort()).toEqual(["ellen", "jurgen"]);
    expect(recipientsFor("waste_sync_failed", gezin, []).sort()).toEqual(["ellen", "jurgen"]);
  });

  it("Lynn (gezinslid) krijgt hem nooit, ook met alle voorkeuren aan", () => {
    expect(recipientsFor("waste_sync_failed", gezin, gezin.map((m) => prefs(m.id, true)))).not.toContain("lynn");
  });

  it("een uitgezette beheerder (Kai) of een beheerder zonder account krijgt hem niet", () => {
    const ontvangers = recipientsFor("waste_sync_failed", gezin, gezin.map((m) => prefs(m.id, true)));
    expect(ontvangers).not.toContain("kai");
    expect(ontvangers).not.toContain("oma");
  });

  it("zonder rol-informatie gaat hij naar niemand (nooit per ongeluk naar een gezinslid)", () => {
    expect(recipientsFor("waste_sync_failed", [jurgen, lynn], [prefs("jurgen", true), prefs("lynn", true)])).toEqual([]);
  });
});
