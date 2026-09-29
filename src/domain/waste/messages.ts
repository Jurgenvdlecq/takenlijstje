/**
 * Alle teksten van de afvalkalender, letterlijk uit UX_SPEC §13.16 en §13.10
 * (de enige bron). Dit is de enige plek in de code met deze teksten; de ID
 * staat erbij als commentaar. Puur.
 */
import { addDays, diffDays, parts, zonedDate, zonedTime, type ISODate } from "@/domain/dates";
import type { WasteStream } from "./streams";
import { sortStreams } from "./streams";

export type WasteDirection = "out" | "in";

// ---------------------------------------------------------------------------
// Notatie (UX §13.16)
// ---------------------------------------------------------------------------

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** <dag> = "di 6 okt" */
export function formatWasteDay(date: ISODate): string {
  const { month, day } = parts(date);
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]}`;
}

function hhmm(instant: string | Date, timeZone: string): string {
  const { hour, minute } = zonedTime(instant, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** <tijdstip> = "vandaag 06:15", "gisteren 06:15" of "<dag> 06:15" */
export function formatWasteMoment(instant: string, now: Date, timeZone: string): string {
  const date = zonedDate(instant, timeZone);
  const days = diffDays(date, zonedDate(now, timeZone));
  const day = days === 0 ? "vandaag" : days === 1 ? "gisteren" : formatWasteDay(date);
  return `${day} ${hhmm(instant, timeZone)}`;
}

/** "hh:mm" voor T-78 */
export function formatWasteClock(instant: string, timeZone: string): string {
  return hhmm(instant, timeZone);
}

// ---------------------------------------------------------------------------
// Taaknamen T-01…T-14 (UX §13.3)
// ---------------------------------------------------------------------------

const OUT_NAME: Record<WasteStream, string> = { rest: "Restafval", papier: "Papier", pmd: "PMD" };
const OUT_LOWER: Record<WasteStream, string> = { rest: "restafval", papier: "papier", pmd: "PMD" };

function joinDutch(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}`;
}

/** T-01…T-07 (buiten) en T-08…T-14 (binnen) */
export function wasteTitle(streams: WasteStream[], direction: WasteDirection): string {
  const sorted = sortStreams(streams);
  if (direction === "out") {
    const names = sorted.map((s, i) => (i === 0 ? OUT_NAME[s] : OUT_LOWER[s]));
    return `${joinDutch(names)} buitenzetten`;
  }
  // Binnen: "Restafvalbak", "Papierbak", "PMD-bak"; bij meer bakken "Restafval-, papier- en PMD-bak"
  const stems = sorted.map((s, i) => (i === 0 ? OUT_NAME[s] : OUT_LOWER[s]));
  const last = sorted[sorted.length - 1];
  const bak = (s: WasteStream, stem: string) => (s === "pmd" ? `${stem}-bak` : `${stem}bak`);
  if (sorted.length === 1) return `${bak(last, stems[0])} binnenzetten`;
  const heads = stems.slice(0, -1).map((stem) => `${stem}-`);
  return `${joinDutch([...heads, bak(last, stems[stems.length - 1])])} binnenzetten`;
}

// ---------------------------------------------------------------------------
// Vaste teksten (UX §13.16)
// ---------------------------------------------------------------------------

export const WASTE_TEXT = {
  /** T-15 */ badge: "Afvalkalender",
  /** T-16 */ outFrom: "vanaf 22:00",
  /** T-17 */ outBefore: "vóór 07:45",
  /** T-18 */ inFrom: "vanaf 12:00",
  /** T-19 (oude UI) */ tomorrow: "Morgen",
  /** T-27 */ explain:
    "De ophaaldag komt uit de afvalkalender van de gemeente. Daarom kun je deze taak niet verplaatsen, wijzigen of verwijderen. Verschuift de gemeente de dag, dan schuift de taak vanzelf mee.",
  /** T-31 */ skippedBoth: "Overgeslagen, ook het binnenzetten",
  /** T-33 */ forbidden: "Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen.",
  /** T-34 */ sectionDescription: "Ophaaldagen van Den Haag als taak.",
  /** T-34b */ jumpLink: "Afval",
  /** T-37 */ notUpdated: "Niet bijgewerkt",
  /** T-38 */ memberOn: "Ophaaldagen van de gemeente komen vanzelf als taak in de lijst.",
  /** T-38b */ memberOnTitle: "Afvalkalender staat aan",
  /** T-39b */ memberOffTitle: "Afvalkalender staat uit",
  /** T-39c */ notificationLabel: "Afvalkalender",
  /** T-40 (vet: buitenzetten, binnenzetten) */ intro: [
    "De app leest de huisvuilkalender van Den Haag en zet voor restafval, papier en PMD zelf de taken klaar: de avond ervoor ",
    "buitenzetten",
    ", op de ophaaldag ",
    "binnenzetten",
    ".",
  ] as const,
  /** T-41 */ postcodeLabel: "Postcode",
  postcodePlaceholder: "2517 AB",
  houseNumberLabel: "Huisnummer",
  suffixLabel: "Toevoeging (optioneel)",
  suffixPlaceholder: "A of 2",
  /** T-41b */ search: "Adres zoeken",
  searching: "Zoeken…",
  /** T-42 */ privacy: "Alleen postcode en huisnummer gaan naar de gemeente. Alleen beheerders zien het adres.",
  /** T-43 */ postcodeError: "Vul een postcode in zoals 2517 AB",
  /** T-44 */ houseNumberError: "Vul een huisnummer in, zoals 12 of 12A",
  /** T-44b */ suffixError: "Een toevoeging heeft hooguit 4 letters of cijfers",
  /** T-45 */ confirmTitle: "Klopt dit?",
  confirmSubtitle: "Zo kent de gemeente jullie adres.",
  nextPickupsHeading: "Eerstvolgende ophaaldagen",
  streamLabels: { rest: "Restafval", papier: "Papier", pmd: "PMD" } as Record<WasteStream, string>,
  /** T-45b */ noDateKnown: "nog geen ophaaldag bekend",
  /** T-46 (vet: buitenzetten, binnenzetten) */ confirmExplain: [
    "De avond vóór elke ophaaldag staat er een taak ",
    "buitenzetten",
    ", met een herinnering om 21:00. Op de ophaaldag vanaf 12:00 een taak ",
    "binnenzetten",
    ", met een herinnering om 18:00. Iedereen in het huishouden ziet de taken. Het adres zien alleen beheerders.",
  ] as const,
  /** T-46b */ enable: "Ja, aanzetten",
  useAddress: "Ja, dit adres gebruiken",
  busy: "Bezig…",
  otherAddress: "Ander adres",
  /** T-47 */ changeTitle: "Ander adres",
  changeLine: "Het huidige adres blijft gebruikt tot je het nieuwe bevestigt.",
  cancel: "Annuleren",
  /** T-48 */ changeReplace: "Open afvaltaken van het oude adres worden vervangen. Wat al gedaan is, blijft in de historie.",
  /** T-60 */ notFound:
    "Dit adres staat niet in de huisvuilkalender van Den Haag. Controleer postcode en huisnummer. De afvalkalender werkt alleen voor adressen in Den Haag.",
  /** T-62 */ noStreams:
    "Voor dit adres geeft de gemeente geen ophaaldagen voor restafval, papier of PMD. Gebruiken jullie een ondergrondse container? Dan hoeft er niets buiten te staan.",
  /** T-63 */ unreachable: "De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen.",
  retry: "Opnieuw proberen",
  /** T-63b */ unreachableChange:
    "De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen; het huidige adres blijft gebruikt.",
  /** T-64 */ noUpcoming:
    "De gemeente geeft voor dit adres nog geen komende ophaaldagen. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen. Probeer het over een paar dagen opnieuw.",
  /** T-64b */ noUpcomingChange:
    "De gemeente geeft voor dit adres nog geen komende ophaaldagen. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen; het huidige adres blijft gebruikt. Probeer het over een paar dagen opnieuw.",
  /** T-65 */ saveFailed: "Opslaan lukte niet. Er is niets veranderd. Probeer het opnieuw.",
  /** T-66 */ adminOnly: "Alleen een beheerder kan de afvalkalender aanpassen. Er is niets veranderd.",
  /** T-67 */ offline: "Hiervoor heb je internet nodig",
  /** T-68 */ loadFailed: "De afvalkalender kon niet worden geladen.",
  reload: "Opnieuw",
  /** T-70 / T-72 */ on: "Aan",
  /** T-52 */ explainOn:
    "Taken staan 14 dagen vooraf klaar. De app kijkt twee keer per dag, 's ochtends en aan het eind van de middag, of de gemeente iets veranderd heeft.",
  /** T-50 */ addressLabel: "Adres",
  change: "Wijzigen",
  changeAria: "Adres wijzigen",
  upcomingHeading: "Volgende ophaaldagen",
  /** T-54 */ tipOldUi:
    "Had je zelf al een terugkerende afvaltaak? Die blijft gewoon staan. Stop hem hieronder bij Terugkerend als je hem niet meer nodig hebt.",
  /** T-55 */ disable: "Afvalkalender uitzetten…",
  /** T-71 */ retrying: "De laatste poging lukte niet. De app probeert het elk uur opnieuw.",
  /** T-71b */ retryingGone: "Bij de laatste poging vond de gemeente het adres niet. De app probeert het elk uur opnieuw.",
  /** T-76 */ h1Explain:
    "Het lukt de app al een tijd niet om de ophaaldagen bij de gemeente op te halen. De taken die er staan, blijven staan; nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl.",
  /** T-77 */ h2Title: "Geen komende ophaaldagen meer bekend",
  /** T-77a */ h2ExplainNewYear:
    "De gemeente geeft geen enkele komende ophaaldag meer. Waarschijnlijk staat de kalender van het nieuwe jaar nog niet online. De taken die er staan, blijven staan. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl.",
  /** T-77b */ h2ExplainOther:
    "De gemeente geeft geen enkele komende ophaaldag meer. Dat is ongebruikelijk. De taken die er staan, blijven staan. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl.",
  /** T-77c */ h3Title: "Adres niet meer gevonden",
  /** T-77d knoppen */ checkAddress: "Adres controleren",
  /** T-79 */ tooSoon: "Net geprobeerd. Probeer het over een minuut opnieuw.",
  /** T-80 */ disableTitle: "Afvalkalender uitzetten?",
  /** T-82 */ disableConfirm: "Uitzetten",
  /** T-90 */ savedEnabled: "Afvalkalender staat aan · taken voor 2 weken klaargezet",
  view: "Bekijken",
  /** T-90b */ savedEnabledNoTasks: "Afvalkalender staat aan · taken verschijnen 14 dagen vooraf",
  /** T-91 */ savedChanged: "Nieuw adres opgeslagen · afvaltaken bijgewerkt",
  /** T-92 */ savedUnchanged: "Adres opgeslagen · er verandert niets",
  /** T-93 */ disabled: "Afvalkalender staat uit",
  /** T-94 */ retried: "Afvalkalender bijgewerkt",
} as const;

// ---------------------------------------------------------------------------
// Teksten met invulling
// ---------------------------------------------------------------------------

/** T-20 */
export function wasteDetailHeader(pickupDate: ISODate): string {
  return `Afvalkalender · ophaaldag ${formatWasteDay(pickupDate)}`;
}

/** T-21…T-24: de infolijst in het detail, als [label, waarde] */
export function wasteDetailRows(pickupDate: ISODate, direction: WasteDirection): [string, string][] {
  if (direction === "out") {
    return [
      ["Mag buiten", `${formatWasteDay(addDays(pickupDate, -1))} vanaf 22:00`],
      ["Uiterlijk", `${formatWasteDay(pickupDate)} 07:45`],
    ];
  }
  return [
    ["Binnenzetten", `${formatWasteDay(pickupDate)} vanaf 12:00`],
    ["Uiterlijk", `${formatWasteDay(pickupDate)}, einde van de dag`],
  ];
}

/** T-25 */
export function wasteReminderRow(pickupDate: ISODate, direction: WasteDirection): [string, string] {
  return direction === "out"
    ? ["Herinnering", `${formatWasteDay(addDays(pickupDate, -1))} 21:00`]
    : ["Herinnering", `${formatWasteDay(pickupDate)} 18:00`];
}

/** T-30 */
export function wasteDoneToast(title: string): string {
  return `Gedaan: ${title}`;
}

/** T-39: "Jurgen kan …", "Ellen en Jurgen kunnen …" */
export function wasteAdminsLine(adminNames: string[]): string {
  const names = joinDutch(adminNames);
  return `${names} ${adminNames.length === 1 ? "kan" : "kunnen"} de afvalkalender aanzetten.`;
}

/** T-45a: "<straat> <nr><toev>, Den Haag" of "<adres>, Den Haag" */
export function wasteAddressDisplay(street: string | null, houseNumber: number, suffix: string, fallback: string): string {
  return street ? `${street} ${houseNumber}${suffix}, Den Haag` : `${fallback}, Den Haag`;
}

/** T-61 */
export function wasteChooseLine(houseNumber: number): string {
  return `Op nummer ${houseNumber} staan meerdere adressen. Welke is van jullie?`;
}

/** T-70: "bijgewerkt <tijdstip>" */
export function wasteUpdatedLine(lastSuccessAt: string, now: Date, timeZone: string): string {
  return `bijgewerkt ${formatWasteMoment(lastSuccessAt, now, timeZone)}`;
}

/** T-72: "laatst bijgewerkt <tijdstip>" en sectiekop "Volgende ophaaldagen · stand <dag>" */
export function wasteLastUpdatedLine(lastSuccessAt: string, now: Date, timeZone: string): string {
  return `laatst bijgewerkt ${formatWasteMoment(lastSuccessAt, now, timeZone)}`;
}
export function wasteStandHeading(lastSuccessAt: string, timeZone: string): string {
  return `Volgende ophaaldagen · stand ${formatWasteDay(zonedDate(lastSuccessAt, timeZone))}`;
}

/** T-73 */
export function wasteNextYearNotice(year: number): string {
  return `De kalender voor ${year} staat nog niet online. Ophaaldagen vanaf 1 januari komen erbij zodra hij er is.`;
}

/** T-75 */
export function wasteNotUpdatedSince(lastSuccessAt: string, timeZone: string): string {
  return `Niet bijgewerkt sinds ${formatWasteDay(zonedDate(lastSuccessAt, timeZone))}`;
}

/** T-77d */
export function wasteAddressGoneExplain(address: string): string {
  return `De huisvuilkalender van de gemeente kent ${address} niet meer. Controleer het adres. Tot die tijd komen er geen nieuwe ophaaldagen bij; de taken die er staan, blijven staan.`;
}

/** T-78 */
export function wasteRetryFailedLine(attemptedAt: string, timeZone: string): string {
  return `Opnieuw geprobeerd om ${formatWasteClock(attemptedAt, timeZone)}. Het lukt nog steeds niet.`;
}

/** T-81 / T-81b / T-81c */
export function wasteDisableText(openTasks: number): string {
  const tail = "Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in.";
  if (openTasks >= 2) return `Het adres wordt gewist en de ${openTasks} afvaltaken die nog open staan, verdwijnen. ${tail}`;
  if (openTasks === 1) return `Het adres wordt gewist en de afvaltaak die nog open staat, verdwijnt. ${tail}`;
  return `Het adres wordt gewist. ${tail}`;
}

// ---------------------------------------------------------------------------
// Meldingen M-01…M-05 (UX §13.10). Nooit een adres of naam (BR-58).
// ---------------------------------------------------------------------------

export interface WasteMessageText {
  title: string;
  body: string;
}

/** M-01 (buiten) en M-02 (binnen) */
export function wasteReminderText(title: string, direction: WasteDirection, streamCount: number): WasteMessageText {
  if (direction === "out") {
    return { title: `Herinnering: ${title}`, body: "Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45." };
  }
  return {
    title: `Herinnering: ${title}`,
    body:
      streamCount > 1
        ? "Vandaag was de ophaaldag. Zet de bakken vandaag nog binnen."
        : "Vandaag was de ophaaldag. Zet de bak vandaag nog binnen.",
  };
}

export type WasteVariant = "H1" | "H2" | "H3";

/** M-03 / M-04 / M-05 */
export function wasteFailureMessage(variant: WasteVariant, lastSuccessAt: string, timeZone: string): WasteMessageText {
  switch (variant) {
    case "H2":
      return {
        title: "De afvalkalender kon niet worden bijgewerkt",
        body: "De gemeente geeft geen komende ophaaldagen meer. Soms staat de nieuwe kalender nog niet online. Kijk zelf op huisvuilkalender.denhaag.nl.",
      };
    case "H3":
      return {
        title: "De afvalkalender vindt het adres niet meer",
        body: "De gemeente kent het adres niet meer. Controleer het in Instellingen › Afvalkalender. Tot die tijd komen er geen nieuwe ophaaldagen bij.",
      };
    default:
      return {
        title: "De afvalkalender kon niet worden bijgewerkt",
        body: `Laatst gelukt op ${formatWasteDay(zonedDate(lastSuccessAt, timeZone))}. Nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl.`,
      };
  }
}
