import { describe, expect, it } from "vitest";
import { wasteReminder } from "@/domain/reminders";
import {
  formatWasteDay,
  formatWasteMoment,
  wasteAddressGoneExplain,
  wasteDetailHeader,
  wasteDetailRows,
  wasteDisableText,
  wasteFailureMessage,
  wasteNextYearNotice,
  wasteNotUpdatedSince,
  wasteReminderRow,
  wasteReminderText,
  wasteRetryFailedLine,
  wasteTitle,
  WASTE_TEXT,
  type WasteDirection,
} from "../messages";
import { wasteTaskFields } from "../plan";
import type { WasteStream } from "../streams";

/**
 * WP3b — teksten uit UX §13.16 en §13.10 (enige bron), letterlijk.
 * AC-192, AC-193, AC-195, AC-205, AC-212, AC-213.
 */
const TZ = "Europe/Amsterdam";

// UX §13.16, T-01…T-07 en T-08…T-14, in de volgorde van de tabel
const COMBINATIES: WasteStream[][] = [["rest"], ["papier"], ["pmd"], ["rest", "papier"], ["rest", "pmd"], ["papier", "pmd"], ["rest", "papier", "pmd"]];
const BUITEN = [
  "Restafval buitenzetten",
  "Papier buitenzetten",
  "PMD buitenzetten",
  "Restafval en papier buitenzetten",
  "Restafval en PMD buitenzetten",
  "Papier en PMD buitenzetten",
  "Restafval, papier en PMD buitenzetten",
];
const BINNEN = [
  "Restafvalbak binnenzetten",
  "Papierbak binnenzetten",
  "PMD-bak binnenzetten",
  "Restafval- en papierbak binnenzetten",
  "Restafval- en PMD-bak binnenzetten",
  "Papier- en PMD-bak binnenzetten",
  "Restafval-, papier- en PMD-bak binnenzetten",
];

describe("wasteTitle: 7 × 2 = T-01…T-14 letterlijk (AC-195, UX §13.3)", () => {
  it.each(COMBINATIES.map((c, i) => [`T-${String(i + 1).padStart(2, "0")}`, c, BUITEN[i]] as const))("%s buiten %j → %s", (_id, bakken, naam) => {
    expect(wasteTitle(bakken, "out")).toBe(naam);
  });

  it.each(COMBINATIES.map((c, i) => [`T-${String(i + 8).padStart(2, "0")}`, c, BINNEN[i]] as const))("%s binnen %j → %s", (_id, bakken, naam) => {
    expect(wasteTitle(bakken, "in")).toBe(naam);
  });

  it("de volgorde van de invoer maakt niet uit (vaste volgorde restafval, papier, PMD)", () => {
    expect(wasteTitle(["pmd", "papier", "rest"], "out")).toBe("Restafval, papier en PMD buitenzetten");
    expect(wasteTitle(["pmd", "rest"], "in")).toBe("Restafval- en PMD-bak binnenzetten");
  });

  it("alle namen zijn hooguit 80 tekens (§18.4.1)", () => {
    for (const bakken of COMBINATIES) for (const richting of ["out", "in"] as WasteDirection[]) {
      expect(wasteTitle(bakken, richting).length).toBeLessThanOrEqual(80);
    }
  });
});

describe("notatie <dag> en <tijdstip> (UX §13.16)", () => {
  it('"di 6 okt"', () => {
    expect(formatWasteDay("2026-10-06")).toBe("di 6 okt");
    expect(formatWasteDay("2026-12-25")).toBe("vr 25 dec");
    expect(formatWasteDay("2027-03-29")).toBe("ma 29 mrt");
  });

  it('"vandaag 06:15", "gisteren 06:15" of "<dag> 06:15"', () => {
    const now = new Date("2026-10-06T10:00:00Z");
    expect(formatWasteMoment("2026-10-06T04:15:00Z", now, TZ)).toBe("vandaag 06:15");
    expect(formatWasteMoment("2026-10-05T04:15:00Z", now, TZ)).toBe("gisteren 06:15");
    expect(formatWasteMoment("2026-10-03T04:15:00Z", now, TZ)).toBe("za 3 okt 06:15");
  });
});

describe("detail T-20…T-25 (AC-192, AC-193, AC-211)", () => {
  it("buitenzetten voor di 6 okt: T-20, T-21, T-22 en herinnering ma 5 okt 21:00", () => {
    expect(wasteDetailHeader("2026-10-06")).toBe("Afvalkalender · ophaaldag di 6 okt");
    expect(wasteDetailRows("2026-10-06", "out")).toEqual([
      ["Mag buiten", "ma 5 okt vanaf 22:00"],
      ["Uiterlijk", "di 6 okt 07:45"],
    ]);
    expect(wasteReminderRow("2026-10-06", "out")).toEqual(["Herinnering", "ma 5 okt 21:00"]);
  });

  it("binnenzetten voor di 6 okt: T-23, T-24 en herinnering di 6 okt 18:00", () => {
    expect(wasteDetailRows("2026-10-06", "in")).toEqual([
      ["Binnenzetten", "di 6 okt vanaf 12:00"],
      ["Uiterlijk", "di 6 okt, einde van de dag"],
    ]);
    expect(wasteReminderRow("2026-10-06", "in")).toEqual(["Herinnering", "di 6 okt 18:00"]);
  });

  it("vaste teksten T-15…T-18, T-27, T-31, T-33 letterlijk", () => {
    expect(WASTE_TEXT.badge).toBe("Afvalkalender");
    expect(WASTE_TEXT.outFrom).toBe("vanaf 22:00");
    expect(WASTE_TEXT.outBefore).toBe("vóór 07:45");
    expect(WASTE_TEXT.inFrom).toBe("vanaf 12:00");
    expect(WASTE_TEXT.explain).toBe(
      "De ophaaldag komt uit de afvalkalender van de gemeente. Daarom kun je deze taak niet verplaatsen, wijzigen of verwijderen. Verschuift de gemeente de dag, dan schuift de taak vanzelf mee.",
    );
    expect(WASTE_TEXT.skippedBoth).toBe("Overgeslagen, ook het binnenzetten");
    expect(WASTE_TEXT.forbidden).toBe("Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen.");
  });

  it("toast- en instellingenteksten T-60, T-62, T-63, T-64, T-65, T-66, T-79, T-90…T-94 letterlijk", () => {
    expect(WASTE_TEXT.notFound).toBe(
      "Dit adres staat niet in de huisvuilkalender van Den Haag. Controleer postcode en huisnummer. De afvalkalender werkt alleen voor adressen in Den Haag.",
    );
    expect(WASTE_TEXT.noStreams).toBe(
      "Voor dit adres geeft de gemeente geen ophaaldagen voor restafval, papier of PMD. Gebruiken jullie een ondergrondse container? Dan hoeft er niets buiten te staan.",
    );
    expect(WASTE_TEXT.unreachable).toBe("De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen.");
    expect(WASTE_TEXT.unreachableChange).toBe(
      "De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen; het huidige adres blijft gebruikt.",
    );
    expect(WASTE_TEXT.saveFailed).toBe("Opslaan lukte niet. Er is niets veranderd. Probeer het opnieuw.");
    expect(WASTE_TEXT.adminOnly).toBe("Alleen een beheerder kan de afvalkalender aanpassen. Er is niets veranderd.");
    expect(WASTE_TEXT.tooSoon).toBe("Net geprobeerd. Probeer het over een minuut opnieuw.");
    expect(WASTE_TEXT.savedEnabled).toBe("Afvalkalender staat aan · taken voor 2 weken klaargezet");
    expect(WASTE_TEXT.savedEnabledNoTasks).toBe("Afvalkalender staat aan · taken verschijnen 14 dagen vooraf");
    expect(WASTE_TEXT.savedChanged).toBe("Nieuw adres opgeslagen · afvaltaken bijgewerkt");
    expect(WASTE_TEXT.savedUnchanged).toBe("Adres opgeslagen · er verandert niets");
    expect(WASTE_TEXT.disabled).toBe("Afvalkalender staat uit");
    expect(WASTE_TEXT.retried).toBe("Afvalkalender bijgewerkt");
    expect(WASTE_TEXT.retrying).toBe("De laatste poging lukte niet. De app probeert het elk uur opnieuw.");
    expect(WASTE_TEXT.retryingGone).toBe("Bij de laatste poging vond de gemeente het adres niet. De app probeert het elk uur opnieuw.");
  });
});

describe("uitzetten T-81 / T-81b / T-81c (AC-213)", () => {
  it("bij 4 open taken: T-81", () => {
    expect(wasteDisableText(4)).toBe(
      "Het adres wordt gewist en de 4 afvaltaken die nog open staan, verdwijnen. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in.",
    );
  });
  it("bij 1: T-81b (enkelvoud)", () => {
    expect(wasteDisableText(1)).toBe(
      "Het adres wordt gewist en de afvaltaak die nog open staat, verdwijnt. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in.",
    );
  });
  it('bij 0: T-81c, zonder zin over taken en zonder "(0 taken)"', () => {
    const tekst = wasteDisableText(0);
    expect(tekst).toBe("Het adres wordt gewist. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in.");
    expect(tekst).not.toMatch(/0|taak|taken/);
  });
});

describe("herinneringen M-01 en M-02 (AC-194, AC-195)", () => {
  it("M-01 buitenzetten", () => {
    expect(wasteReminderText("Restafval buitenzetten", "out", 1)).toEqual({
      title: "Herinnering: Restafval buitenzetten",
      body: "Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45.",
    });
  });
  it("M-02 binnenzetten, één bak", () => {
    expect(wasteReminderText("Restafvalbak binnenzetten", "in", 1)).toEqual({
      title: "Herinnering: Restafvalbak binnenzetten",
      body: "Vandaag was de ophaaldag. Zet de bak vandaag nog binnen.",
    });
  });
  it("M-02 binnenzetten, meer bakken: meervoud", () => {
    expect(wasteReminderText("Restafval- en papierbak binnenzetten", "in", 2).body).toBe("Vandaag was de ophaaldag. Zet de bakken vandaag nog binnen.");
  });
});

describe("storingsmeldingen M-03 / M-04 / M-05 (AC-205, UX §13.10)", () => {
  it("M-03 (H1) met <dag> van het laatste succes", () => {
    expect(wasteFailureMessage("H1", "2026-09-26T04:05:00Z", TZ)).toEqual({
      title: "De afvalkalender kon niet worden bijgewerkt",
      body: "Laatst gelukt op za 26 sep. Nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl.",
    });
  });
  it("M-04 (H2)", () => {
    expect(wasteFailureMessage("H2", "2026-09-26T04:05:00Z", TZ)).toEqual({
      title: "De afvalkalender kon niet worden bijgewerkt",
      body: "De gemeente geeft geen komende ophaaldagen meer. Soms staat de nieuwe kalender nog niet online. Kijk zelf op huisvuilkalender.denhaag.nl.",
    });
  });
  it("M-05 (H3)", () => {
    expect(wasteFailureMessage("H3", "2026-09-26T04:05:00Z", TZ)).toEqual({
      title: "De afvalkalender vindt het adres niet meer",
      body: "De gemeente kent het adres niet meer. Controleer het in Instellingen › Afvalkalender. Tot die tijd komen er geen nieuwe ophaaldagen bij.",
    });
  });
  it("overige zinnen T-73, T-75, T-78", () => {
    expect(wasteNextYearNotice(2027)).toBe("De kalender voor 2027 staat nog niet online. Ophaaldagen vanaf 1 januari komen erbij zodra hij er is.");
    expect(wasteNotUpdatedSince("2026-09-26T04:05:00Z", TZ)).toBe("Niet bijgewerkt sinds za 26 sep");
    expect(wasteRetryFailedLine("2026-09-29T07:42:00Z", TZ)).toBe("Opnieuw geprobeerd om 09:42. Het lukt nog steeds niet.");
  });
});

describe("AC-212: geen adres, adrescode of namen in de builders", () => {
  // Het fixture-adres en de adrescode; de builders krijgen ze nooit, maar ook niet via een omweg
  const verboden = [/2511/, /\bAB\b/, /Voorbeeldstraat/, /0518200000000101/, /Jurgen|Ellen|Lynn|Kai/, /Zwedenburg/, /2591/];
  const uitvoer: string[] = [];
  for (const bakken of COMBINATIES) for (const richting of ["out", "in"] as WasteDirection[]) {
    const velden = wasteTaskFields("2026-10-06", richting, bakken, TZ);
    uitvoer.push(velden.title, ...Object.values(wasteReminderText(velden.title, richting, bakken.length)));
    const herinnering = wasteReminder(
      { id: "t1", title: velden.title, status: "todo", pickupDate: "2026-10-06", direction: richting, streamCount: bakken.length },
      new Date(richting === "out" ? "2026-10-05T19:05:00Z" : "2026-10-06T16:05:00Z"),
      TZ,
    );
    if (herinnering) uitvoer.push(herinnering.title, herinnering.body ?? "", herinnering.dedupeKey);
  }
  for (const variant of ["H1", "H2", "H3"] as const) uitvoer.push(...Object.values(wasteFailureMessage(variant, "2026-09-26T04:05:00Z", TZ)));
  uitvoer.push(wasteDetailHeader("2026-10-06"), ...wasteDetailRows("2026-10-06", "out").flat(), ...wasteDetailRows("2026-10-06", "in").flat());

  it("titels, herinneringen (met dedupe-sleutel), storingsmeldingen en het detail bevatten geen adres of naam", () => {
    expect(uitvoer.length).toBeGreaterThan(40);
    for (const tekst of uitvoer) for (const patroon of verboden) expect(tekst).not.toMatch(patroon);
  });

  it("T-77d is de enige tekst met het adres, en alleen voor de beheerder in de instellingen", () => {
    expect(wasteAddressGoneExplain("2511 AB 12A")).toContain("2511 AB 12A");
  });
});
