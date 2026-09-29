/**
 * WP3b — Afvalkalender (W-03) in de huidige schermen, 390×844.
 * E2E-kolom van TECHNICAL_DESIGN §18.15; teksten letterlijk uit UX §13.16.
 *
 * Vereist naast de lokale stack (support/local-stack.sh, `npm run seed`):
 * - de stub van de gemeentebron (support/waste-stub.mjs; Playwright start hem zelf);
 * - een app met WASTE_SOURCE_BASE_URL=http://127.0.0.1:<stubpoort>
 *   (E2E_START_APP=1, of zelf: support/start-app.sh).
 *
 * De server van de app gebruikt de echte klok. Tijdafhankelijke toestanden
 * (storing, 48 uur) worden daarom in de testdatabase gezet (service role);
 * de stub-datums zijn relatief aan vandaag. Het scherm-"nu" voor de lijsten
 * wordt waar nodig met page.clock vastgezet.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { expectToast, login } from "./helpers";
import { adminDb, familie } from "./support/db";
import {
  amsterdam,
  calendarRow,
  clearLookupWindow,
  clearWaste,
  dag,
  day,
  insertCalendar,
  insertWasteTask,
  klok,
  setLookupCount,
  setRole,
  stubCounts,
  stubScenario,
  stubTotal,
  updateCalendar,
  wasteTasks,
} from "./support/waste";

const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_APP_PORT ?? 3100}`;

// ---------------------------------------------------------------------------
// Teksten (UX §13.16), letterlijk
// ---------------------------------------------------------------------------
const T = {
  t15: "Afvalkalender",
  t16: "vanaf 22:00",
  t17: "vóór 07:45",
  t18: "vanaf 12:00",
  t27: "De ophaaldag komt uit de afvalkalender van de gemeente. Daarom kun je deze taak niet verplaatsen, wijzigen of verwijderen. Verschuift de gemeente de dag, dan schuift de taak vanzelf mee.",
  t31: "Overgeslagen, ook het binnenzetten",
  t34: "Ophaaldagen van Den Haag als taak.",
  t37: "Niet bijgewerkt",
  t38: "Ophaaldagen van de gemeente komen vanzelf als taak in de lijst.",
  t38b: "Afvalkalender staat aan",
  t39b: "Afvalkalender staat uit",
  t40: "De app leest de huisvuilkalender van Den Haag en zet voor restafval, papier en PMD zelf de taken klaar: de avond ervoor buitenzetten, op de ophaaldag binnenzetten.",
  t42: "Alleen postcode en huisnummer gaan naar de gemeente. Alleen beheerders zien het adres.",
  t43: "Vul een postcode in zoals 2517 AB",
  t44: "Vul een huisnummer in, zoals 12 of 12A",
  t44b: "Een toevoeging heeft hooguit 4 letters of cijfers",
  t45: "Klopt dit?",
  t45sub: "Zo kent de gemeente jullie adres.",
  t45kop: "Eerstvolgende ophaaldagen",
  t45b: "nog geen ophaaldag bekend",
  t46: "De avond vóór elke ophaaldag staat er een taak buitenzetten, met een herinnering om 21:00. Op de ophaaldag vanaf 12:00 een taak binnenzetten, met een herinnering om 18:00. Iedereen in het huishouden ziet de taken. Het adres zien alleen beheerders.",
  t47titel: "Ander adres",
  t47: "Het huidige adres blijft gebruikt tot je het nieuwe bevestigt.",
  t48: "Open afvaltaken van het oude adres worden vervangen. Wat al gedaan is, blijft in de historie.",
  t50kop: "Volgende ophaaldagen",
  t52: "Taken staan 14 dagen vooraf klaar. De app kijkt twee keer per dag, 's ochtends en aan het eind van de middag, of de gemeente iets veranderd heeft.",
  t54: "Had je zelf al een terugkerende afvaltaak? Die blijft gewoon staan. Stop hem hieronder bij Terugkerend als je hem niet meer nodig hebt.",
  t55: "Afvalkalender uitzetten…",
  t60: "Dit adres staat niet in de huisvuilkalender van Den Haag. Controleer postcode en huisnummer. De afvalkalender werkt alleen voor adressen in Den Haag.",
  t62: "Voor dit adres geeft de gemeente geen ophaaldagen voor restafval, papier of PMD. Gebruiken jullie een ondergrondse container? Dan hoeft er niets buiten te staan.",
  t63: "De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen.",
  t63b: "De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen; het huidige adres blijft gebruikt.",
  t64: "De gemeente geeft voor dit adres nog geen komende ophaaldagen. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen. Probeer het over een paar dagen opnieuw.",
  t64b: "De gemeente geeft voor dit adres nog geen komende ophaaldagen. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen; het huidige adres blijft gebruikt. Probeer het over een paar dagen opnieuw.",
  t66: "Alleen een beheerder kan de afvalkalender aanpassen. Er is niets veranderd.",
  t67: "Hiervoor heb je internet nodig",
  t71: "De laatste poging lukte niet. De app probeert het elk uur opnieuw.",
  t71b: "Bij de laatste poging vond de gemeente het adres niet. De app probeert het elk uur opnieuw.",
  t76: "Het lukt de app al een tijd niet om de ophaaldagen bij de gemeente op te halen. De taken die er staan, blijven staan; nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl.",
  t77: "Geen komende ophaaldagen meer bekend",
  t77b: "De gemeente geeft geen enkele komende ophaaldag meer. Dat is ongebruikelijk. De taken die er staan, blijven staan. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl.",
  t77c: "Adres niet meer gevonden",
  t77d: "De huisvuilkalender van de gemeente kent 2591 BB 87 niet meer. Controleer het adres. Tot die tijd komen er geen nieuwe ophaaldagen bij; de taken die er staan, blijven staan.",
  t77e: "Bezig…",
  t79: "Net geprobeerd. Probeer het over een minuut opnieuw.",
  t80: "Afvalkalender uitzetten?",
  t81_4: "Het adres wordt gewist en de 4 afvaltaken die nog open staan, verdwijnen. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in.",
  t81c: "Het adres wordt gewist. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in.",
  t90: "Afvalkalender staat aan · taken voor 2 weken klaargezet",
  t90b: "Afvalkalender staat aan · taken verschijnen 14 dagen vooraf",
  t91: "Nieuw adres opgeslagen · afvaltaken bijgewerkt",
  t92: "Adres opgeslagen · er verandert niets",
  t93: "Afvalkalender staat uit",
  t94: "Afvalkalender bijgewerkt",
};

// ---------------------------------------------------------------------------
// Hulpjes
// ---------------------------------------------------------------------------
let householdId: string;
let lid: Awaited<ReturnType<typeof familie>>["lid"];

test.beforeEach(async () => {
  ({ householdId, lid } = await familie());
  await clearWaste(householdId);
  await clearLookupWindow(householdId); // D-049: de suite doet meer dan 20 opzoekingen per uur
  await stubScenario("normaal");
});

test.afterAll(async () => {
  const f = await familie();
  await clearWaste(f.householdId);
  await setRole(f.lid("Ellen").id, "admin");
  await stubScenario("normaal");
});

const section = (page: Page) => page.locator("#afvalkalender");
const toasts = (page: Page) => page.locator("[data-sonner-toast]");

async function openSettings(page: Page) {
  await page.goto("/instellingen#afvalkalender");
  await expect(section(page).getByRole("heading", { name: "Afvalkalender", level: 2 })).toBeVisible();
  await expect(section(page).getByLabel("Laden")).toHaveCount(0);
}

async function fillAddress(page: Page, postcode: string, nr: string, suffix = "") {
  const s = section(page);
  await s.getByLabel("Postcode").fill(postcode);
  await s.getByLabel("Huisnummer").fill(nr);
  if (suffix) await s.getByLabel("Toevoeging (optioneel)").fill(suffix);
}

async function search(page: Page) {
  await section(page).getByRole("button", { name: "Adres zoeken" }).click();
}

/** Aanzetten via de interface met stub "normaal" (4 afvaltaken: D+2 en D+9, buiten en binnen) */
async function enableViaUi(page: Page) {
  await openSettings(page);
  await fillAddress(page, "2591 BB", "87");
  await search(page);
  await expect(section(page)).toContainText(T.t45);
  await section(page).getByRole("button", { name: "Ja, aanzetten" }).click();
  await expectToast(page, T.t90);
  await expect(section(page).getByRole("button", { name: "Adres wijzigen" })).toBeVisible();
  await expect.poll(async () => (await wasteTasks(householdId)).length).toBe(4);
}

async function alsGebruiker(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE, locale: "nl-NL", timezoneId: "Europe/Amsterdam", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await login(page, email);
  return page;
}

/** Datumrij (bak → datum of T-45b) binnen de sectie */
function pickupRow(page: Page, bak: "Restafval" | "Papier" | "PMD") {
  return section(page).locator("dl > div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${bak}$`) }) });
}

// =============================================================================
// AC-183 (a) — aanzetten, taken binnen 14 dagen → T-90 met Bekijken
// =============================================================================
test("AC-183 (a): adres zoeken → Klopt dit? (T-45, T-45a, T-46) → Ja, aanzetten → T-90 met Bekijken, taken op Vandaag en in de Kalender", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);

  // A — uit (T-34, T-40, T-41, T-42)
  await expect(s).toContainText(T.t34);
  await expect(s).toContainText(T.t40);
  await expect(s).toContainText(T.t42);
  await expect(s.getByLabel("Postcode")).toHaveAttribute("placeholder", "2517 AB");
  await expect(s.getByLabel("Toevoeging (optioneel)")).toHaveAttribute("placeholder", "A of 2");

  await fillAddress(page, "2591 BB", "87");
  await search(page);

  // C — Klopt dit?
  await expect(s.getByRole("heading", { name: T.t45 })).toBeVisible();
  await expect(s).toContainText(T.t45sub);
  await expect(s).toContainText("Zwedenburg 87, Den Haag");
  await expect(s).not.toContainText("'s-Gravenhage");
  await expect(s).toContainText(T.t45kop);
  await expect(pickupRow(page, "Restafval")).toContainText(dag(day(2)));
  await expect(pickupRow(page, "Papier")).toContainText(dag(day(2)));
  await expect(pickupRow(page, "PMD")).toContainText(dag(day(9)));
  await expect(s).toContainText(T.t46);
  expect(await calendarRow(householdId), "vóór bevestigen is er niets bewaard").toBeNull();

  await s.getByRole("button", { name: "Ja, aanzetten" }).click();
  const toast = toasts(page).filter({ hasText: T.t90 });
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button", { name: "Bekijken" })).toBeVisible();

  // Bewaard; per ophaaldag in [vandaag, vandaag+14] één buiten- en één binnenzet-taak
  const cal = await calendarRow(householdId);
  expect(cal).toMatchObject({ postcode: "2591BB", house_number: 87, house_suffix: "" });
  const tasks = await wasteTasks(householdId);
  expect(tasks.map((t) => `${t.waste_pickup_date}/${t.waste_direction}`).sort()).toEqual(
    [`${day(2)}/in`, `${day(2)}/out`, `${day(9)}/in`, `${day(9)}/out`].sort(),
  );
  expect(tasks.find((t) => t.waste_pickup_date === day(2) && t.waste_direction === "out")?.title).toBe("Restafval en papier buitenzetten");
  expect(tasks.find((t) => t.waste_pickup_date === day(9) && t.waste_direction === "in")?.title).toBe("Restafval- en PMD-bak binnenzetten");

  // G — aan (T-70, T-50, T-52, T-54, T-55)
  await expect(s).toContainText(new RegExp(`Aan · bijgewerkt vandaag \\d\\d:\\d\\d`));
  await expect(s).toContainText("2591 BB 87");
  await expect(s.getByRole("button", { name: "Adres wijzigen" })).toHaveText("Wijzigen");
  await expect(s.getByRole("heading", { name: T.t50kop, exact: true })).toBeVisible();
  await expect(s).toContainText(T.t52);
  await expect(s).toContainText(T.t54);
  await expect(s.getByRole("button", { name: T.t55 })).toBeVisible();

  // Bekijken → Kalender (week) met de afvaltaak
  await toast.getByRole("button", { name: "Bekijken" }).click();
  await expect(page).toHaveURL(/\/kalender/);
  await expect(page.getByText("Restafval en papier buitenzetten").first()).toBeVisible();

  // Vandaag-scherm: de buitenzet-taak (gepland morgen) staat onder Binnenkort
  await page.goto("/");
  const binnenkort = page.locator("section").filter({ has: page.getByRole("heading", { name: /Binnenkort/ }) });
  const meer = binnenkort.getByRole("button", { name: /Toon alles/ });
  if (await meer.count()) await meer.click();
  await expect(binnenkort.getByText("Restafval en papier buitenzetten")).toBeVisible();
});

// =============================================================================
// AC-183 (b) — eerstvolgende ophaaldag over 3 weken → C (geen F2) → T-90b, 0 taken
// =============================================================================
test("AC-183 (b): eerstvolgende ophaaldag over 3 weken → C met T-45b, aanzetten → T-90b zonder Bekijken, 0 afvaltaken", async ({ page }) => {
  await stubScenario("drie_weken");
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await fillAddress(page, "2591 BB", "87");
  await search(page);

  await expect(s.getByRole("heading", { name: T.t45 })).toBeVisible();
  await expect(pickupRow(page, "Papier")).toContainText(dag(day(21)));
  await expect(pickupRow(page, "Restafval")).toContainText(T.t45b);
  await expect(pickupRow(page, "PMD")).toContainText(T.t45b);
  await expect(s).not.toContainText("nog geen komende ophaaldagen");

  await s.getByRole("button", { name: "Ja, aanzetten" }).click();
  const toast = toasts(page).filter({ hasText: T.t90b });
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button", { name: "Bekijken" })).toHaveCount(0);

  expect(await calendarRow(householdId)).toMatchObject({ postcode: "2591BB", house_number: 87 });
  expect(await wasteTasks(householdId)).toEqual([]);
  // Geen stille regel en geen storing; de datum staat onder Volgende ophaaldagen
  await expect(s).toContainText(/Aan · bijgewerkt vandaag/);
  await expect(s).not.toContainText(T.t71);
  await expect(s).not.toContainText(T.t37);
  await expect(pickupRow(page, "Papier")).toContainText(dag(day(21)));
});

// =============================================================================
// AC-184 — ongeldig formaat: veldfouten, knop uit, niets opgevraagd
// =============================================================================
test("AC-184: lege velden → Adres zoeken uit; ongeldige postcode/huisnummer/toevoeging → T-43/T-44/T-44b; geen verzoek naar de gemeente", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  const zoek = s.getByRole("button", { name: "Adres zoeken" });

  await expect(zoek).toBeDisabled();
  await s.getByLabel("Postcode").fill("2591 BB");
  await expect(zoek).toBeDisabled();
  await s.getByLabel("Postcode").fill("");
  await s.getByLabel("Huisnummer").fill("87");
  await expect(zoek).toBeDisabled();

  await fillAddress(page, "0123 AB", "87");
  await zoek.click();
  await expect(s).toContainText(T.t43);

  // D-048: T-44 al bij het verlaten van het huisnummerveld, nog vóór Zoeken
  await fillAddress(page, "2591 BB", "abc");
  await s.getByLabel("Huisnummer").blur();
  await expect(s).toContainText(T.t44);
  await zoek.click();
  await expect(s).toContainText(T.t44);
  // Na Zoeken is de (inmiddels geldige) postcode niet meer als fout gemarkeerd
  await expect(s).not.toContainText(T.t43);

  await fillAddress(page, "2591 BB", "0");
  await zoek.click();
  await expect(s).toContainText(T.t44);

  await fillAddress(page, "2591 BB", "87", "A.1");
  await zoek.click();
  await expect(s).toContainText(T.t44b);

  expect(await stubTotal(), "geen enkel verzoek naar de gemeente").toBe(0);
  expect(await calendarRow(householdId)).toBeNull();
});

test("AC-184: huisnummer 100000 (buiten 1 t/m 99999) → T-44, geen verzoek naar de gemeente", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await fillAddress(page, "2591 BB", "100000");
  await s.getByRole("button", { name: "Adres zoeken" }).click();
  await expect(s).toContainText(T.t44);
  expect(await stubTotal(), "geen enkel verzoek naar de gemeente").toBe(0);
});

test("AC-183/184: huisnummer 87 zonder toevoeging blijft 87 na het verlaten van het veld (geen splitsing in 8 + toevoeging 7)", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await fillAddress(page, "2591 BB", "87");
  await s.getByLabel("Huisnummer").blur();
  await expect(s.getByLabel("Huisnummer")).toHaveValue("87");
  await expect(s.getByLabel("Toevoeging (optioneel)")).toHaveValue("");
});

// =============================================================================
// AC-185 — onbekend adres → D (T-60), velden gevuld, niets bewaard
// =============================================================================
test("AC-185: onbekend adres → T-60 boven de velden zonder rode rand, velden blijven gevuld, niets bewaard", async ({ page }) => {
  await stubScenario("onbekend");
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await fillAddress(page, "2281 AA", "1");
  await search(page);

  await expect(s.getByRole("alert")).toHaveText(T.t60);
  await expect(s.getByLabel("Postcode")).toHaveValue("2281 AA");
  await expect(s.getByLabel("Huisnummer")).toHaveValue("1");
  await expect(s.getByLabel("Postcode")).toHaveAttribute("aria-invalid", "false");
  await expect(s.getByLabel("Huisnummer")).toHaveAttribute("aria-invalid", "false");
  expect(await calendarRow(householdId)).toBeNull();
  expect(await wasteTasks(householdId)).toEqual([]);
});

// =============================================================================
// AC-186 — alleen GFT → E (T-62), niets bewaard, geen C(J−1)
// =============================================================================
test("AC-186: adres met alleen GFT → T-62, niets bewaard, geen verzoek naar de kalender van vorig jaar", async ({ page }) => {
  await stubScenario("alleen_gft");
  await login(page, "jurgen@example.com");
  await openSettings(page);
  await fillAddress(page, "2591 BB", "87");
  await search(page);

  await expect(section(page)).toContainText(T.t62);
  expect(await calendarRow(householdId)).toBeNull();
  const vorigJaar = Number(day(0).slice(0, 4)) - 1;
  const counts = await stubCounts();
  expect(Object.keys(counts).filter((p) => p.endsWith(`/kalender/${vorigJaar}`))).toEqual([]);
});

// =============================================================================
// AC-187 — schrijfwijze en meerdere adressen
// =============================================================================
test("AC-187 (c): meerdere adressen op nummer 12 → T-61 met een rij per adres, niets bewaard; rij tikken → Klopt dit? voor dat adres", async ({ page }) => {
  await stubScenario("meerdere");
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await fillAddress(page, "2591 BB", "12");
  await search(page);

  await expect(s).toContainText("Op nummer 12 staan meerdere adressen. Welke is van jullie?");
  for (const naam of ["Zwedenburg 12, Den Haag", "Zwedenburg 12A, Den Haag", "Zwedenburg 12B, Den Haag"]) {
    await expect(s.getByRole("button", { name: naam, exact: true })).toBeVisible();
  }
  expect(await calendarRow(householdId)).toBeNull();

  await s.getByRole("button", { name: "Zwedenburg 12A, Den Haag", exact: true }).click();
  await expect(s.getByRole("heading", { name: T.t45 })).toBeVisible();
  await expect(s).toContainText("Zwedenburg 12A, Den Haag");
  expect(await calendarRow(householdId)).toBeNull();
});

test("AC-187 (a): '2591bb' met '12 a' wordt opgevraagd en bewaard als 2591BB, 12, toevoeging A", async ({ page }) => {
  await stubScenario("meerdere");
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await fillAddress(page, "2591bb", "12 a");
  await search(page);

  await expect(s.getByRole("heading", { name: T.t45 })).toBeVisible();
  await expect(s).toContainText("Zwedenburg 12A, Den Haag");
  await s.getByRole("button", { name: "Ja, aanzetten" }).click();
  await expectToast(page, T.t90);
  expect(await calendarRow(householdId)).toMatchObject({ postcode: "2591BB", house_number: 12, house_suffix: "A", bag_id: "0518200000000121" });
  // De toevoeging gaat nooit naar de bron (TD §18.1.2)
  expect(Object.keys(await stubCounts())).toContain("/rest/adressen/2591BB-12");
});

// =============================================================================
// AC-188 — bron onbereikbaar tijdens het instellen
// =============================================================================
test("AC-188 (a): bron geeft 503 → T-63 met Opnieuw proberen, velden gevuld, niets bewaard", async ({ page }) => {
  await stubScenario("onbereikbaar");
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await fillAddress(page, "2591 BB", "87");
  await search(page);

  await expect(s).toContainText(T.t63);
  await expect(s.getByRole("button", { name: "Opnieuw proberen" })).toBeVisible();
  await expect(s.getByLabel("Postcode")).toHaveValue("2591 BB");
  await expect(s.getByLabel("Huisnummer")).toHaveValue("87");
  expect(await calendarRow(householdId)).toBeNull();
  expect(await wasteTasks(householdId)).toEqual([]);
});

test("AC-188 (a), traag: tijdens het zoeken 'Zoeken…' met velden uit; na de time-out T-63 en niets bewaard", async ({ page }) => {
  test.setTimeout(60_000);
  await stubScenario("traag"); // 10 s per antwoord; de app stopt na 8 s per verzoek
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await fillAddress(page, "2591 BB", "87");
  await search(page);

  await expect(s.getByRole("button", { name: "Zoeken…" })).toBeDisabled();
  await expect(s.getByLabel("Postcode")).toBeDisabled();
  await expect(s.getByLabel("Huisnummer")).toBeDisabled();
  await expect(s).toContainText(T.t63, { timeout: 20_000 });
  expect(await calendarRow(householdId)).toBeNull();
});

// =============================================================================
// D-049 (V-59) — grens op opzoeken: boven 20 per uur T-63 zonder verzoek naar de gemeente
// =============================================================================
test("D-049: na 20 opzoekingen in dit uur → T-63, geen verzoek naar de gemeente, niets bewaard; een uur later werkt het weer", async ({ page }) => {
  await setLookupCount(householdId, 20);
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await fillAddress(page, "2591 BB", "87");
  await search(page);

  await expect(s).toContainText(T.t63);
  expect(await stubTotal(), "boven de grens gaat er niets naar de gemeente").toBe(0);
  expect(await calendarRow(householdId)).toBeNull();

  // Venster verlopen → de opzoeking gaat weer gewoon naar de bron
  await clearLookupWindow(householdId);
  await s.getByRole("button", { name: "Opnieuw proberen" }).click();
  await expect(s.getByRole("heading", { name: T.t45 })).toBeVisible();
  expect(await stubTotal()).toBeGreaterThan(0);
});

// =============================================================================
// AC-188 (b), AC-185, AC-237 (b), AC-214 — wijzigen mislukt → oud adres en taken blijven
// =============================================================================
test("AC-214/185/188 (b)/237 (b): wijzigen naar onbekend, onbereikbaar of zonder komende dagen → T-60/T-63b/T-64b, oud adres en oude taken blijven; Annuleren → G", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await enableViaUi(page);
  const voor = await calendarRow(householdId);
  const takenVoor = (await wasteTasks(householdId)).map((t) => `${t.id}/${t.status}`).sort();
  const s = section(page);

  // A′ — T-47, gevuld met het huidige adres
  await s.getByRole("button", { name: "Adres wijzigen" }).click();
  await expect(s.getByRole("heading", { name: T.t47titel })).toBeVisible();
  await expect(s).toContainText(T.t47);
  await expect(s.getByLabel("Postcode")).toHaveValue("2591 BB");
  await expect(s.getByLabel("Huisnummer")).toHaveValue("87");

  await stubScenario("onbekend");
  await fillAddress(page, "2281 AA", "1");
  await search(page);
  await expect(s.getByRole("alert")).toHaveText(T.t60);

  await stubScenario("onbereikbaar");
  await search(page);
  await expect(s).toContainText(T.t63b);
  await expect(s.getByLabel("Postcode")).toHaveValue("2281 AA");

  await stubScenario("jaareinde");
  await search(page);
  await expect(s).toContainText(T.t64b);
  await expect(s.getByRole("button", { name: "Adres zoeken" })).toBeVisible();

  expect(await calendarRow(householdId)).toEqual(voor);
  expect((await wasteTasks(householdId)).map((t) => `${t.id}/${t.status}`).sort()).toEqual(takenVoor);

  await s.getByRole("button", { name: "Annuleren" }).click();
  await expect(s.getByRole("button", { name: "Adres wijzigen" })).toBeVisible();
  await expect(s).toContainText("2591 BB 87");
  expect(await calendarRow(householdId)).toEqual(voor);
});

// =============================================================================
// AC-214 — adres wijzigen: A′ (T-47) → C (T-48) → T-91
// =============================================================================
test("AC-214: Wijzigen → Ander adres (T-47) → nieuw adres → Klopt dit? met T-48 → Ja, dit adres gebruiken → T-91; open taken vervangen, gedaan blijft", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await enableViaUi(page);
  const oud = await wasteTasks(householdId);
  const gedaan = oud.find((t) => t.waste_pickup_date === day(2) && t.waste_direction === "out")!;
  await adminDb().from("tasks").update({ status: "done", completed_at: new Date().toISOString() } as never).eq("id", gedaan.id);

  const s = section(page);
  await s.getByRole("button", { name: "Adres wijzigen" }).click();
  await expect(s).toContainText(T.t47);
  await stubScenario("normaal_b");
  await fillAddress(page, "2514 AA", "5");
  await search(page);

  await expect(s.getByRole("heading", { name: T.t45 })).toBeVisible();
  await expect(s).toContainText("Nieuwe Parklaan 5, Den Haag");
  await expect(s).toContainText(T.t48);
  await s.getByRole("button", { name: "Ja, dit adres gebruiken" }).click();
  await expectToast(page, T.t91);

  expect(await calendarRow(householdId)).toMatchObject({ postcode: "2514AA", house_number: 5, bag_id: "0518200000999902" });
  const na = await wasteTasks(householdId);
  // De afgevinkte taak van het oude adres blijft ongewijzigd
  expect(na.find((t) => t.id === gedaan.id)).toMatchObject({ status: "done", waste_pickup_date: day(2), waste_direction: "out" });
  // Open taken alleen van het nieuwe adres (D+3 en D+10)
  const open = na.filter((t) => t.status === "todo" || t.status === "in_progress");
  expect(open.map((t) => `${t.waste_pickup_date}/${t.waste_direction}`).sort()).toEqual(
    [`${day(3)}/in`, `${day(3)}/out`, `${day(10)}/in`, `${day(10)}/out`].sort(),
  );
  await expect(s).toContainText("2514 AA 5");
});

// =============================================================================
// AC-222 — hetzelfde adres opnieuw bevestigen → T-92, nooit T-79
// =============================================================================
test("AC-222: hetzelfde adres opnieuw bevestigen vlak na een bijwerking → T-92 (nooit T-79); notitie en 'bezig' blijven, geen dubbele taken", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await enableViaUi(page);
  const voor = await wasteTasks(householdId);
  const bezig = voor.find((t) => t.waste_direction === "out" && t.waste_pickup_date === day(2))!;
  await adminDb().from("tasks").update({ status: "in_progress" } as never).eq("id", bezig.id);
  const notitie = `E2E notitie ${Date.now() % 100000}`;
  const c = await adminDb().from("task_comments").insert({ household_id: householdId, task_id: bezig.id, member_id: lid("Ellen").id, body: notitie } as never);
  expect(c.error).toBeNull();
  // De achtergrondtaak heeft een halve minuut geleden bijgewerkt
  await updateCalendar(householdId, { last_attempt_at: new Date(Date.now() - 30_000).toISOString() });

  const s = section(page);
  await s.getByRole("button", { name: "Adres wijzigen" }).click();
  await search(page);
  await expect(s.getByRole("heading", { name: T.t45 })).toBeVisible();
  await s.getByRole("button", { name: "Ja, dit adres gebruiken" }).click();
  await expectToast(page, T.t92);
  await expect(toasts(page).filter({ hasText: T.t79 })).toHaveCount(0);
  await expect(s).not.toContainText(T.t79);

  const na = await wasteTasks(householdId);
  expect(na.map((t) => t.id).sort()).toEqual(voor.map((t) => t.id).sort());
  expect(na.find((t) => t.id === bezig.id)?.status).toBe("in_progress");
  const { data: comments } = await adminDb().from("task_comments").select("body").eq("task_id", bezig.id);
  expect((comments ?? []).map((x) => (x as { body: string }).body)).toContain(notitie);
});

// =============================================================================
// AC-237 (a) — instellen zonder komende ophaaldagen → F2 (T-64)
// =============================================================================
test("AC-237 (a): geen komende ophaaldag (jaareinde-vorm) → T-64, hoofdknop Adres zoeken, velden gevuld, niets bewaard", async ({ page }) => {
  await stubScenario("jaareinde");
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await fillAddress(page, "2591 BB", "87");
  await search(page);

  await expect(s).toContainText(T.t64);
  await expect(s).not.toContainText(T.t62);
  await expect(s.getByRole("button", { name: "Adres zoeken" })).toBeEnabled();
  await expect(s.getByLabel("Postcode")).toHaveValue("2591 BB");
  await expect(s.getByLabel("Huisnummer")).toHaveValue("87");
  expect(await calendarRow(householdId)).toBeNull();
  expect(await wasteTasks(householdId)).toEqual([]);
});

// =============================================================================
// AC-189 / AC-190 — gezinslid
// =============================================================================
test("AC-189/190: Lynn ziet geen formulier; uit → T-39b met de beheerders, aan → T-38b, ook tijdens een storing geen adres of balk", async ({ page }) => {
  await login(page, "lynn@example.com");
  await openSettings(page);
  const s = section(page);
  await expect(s).toContainText(T.t39b);
  await expect(s).toContainText("Ellen en Jurgen kunnen de afvalkalender aanzetten.");
  await expect(s.getByLabel("Postcode")).toHaveCount(0);
  await expect(s.getByRole("button")).toHaveCount(0);

  await insertCalendar(householdId, {
    last_success_at: new Date(Date.now() - 49 * 3_600_000).toISOString(),
    last_error_code: "UNREACHABLE",
    error_since: new Date(Date.now() - 3_600_000).toISOString(),
    last_failure_at: new Date(Date.now() - 3_600_000).toISOString(),
  });
  await page.reload();
  await expect(s).toContainText(T.t38b);
  await expect(s).toContainText(T.t38);
  await expect(s).not.toContainText("2591");
  await expect(s).not.toContainText(T.t37);
  await expect(s).not.toContainText(T.t76);
  await expect(s.getByRole("button")).toHaveCount(0);
});

test("AC-189: beheerder verliest tijdens het instellen zijn rol → bij bevestigen T-66, niets bewaard, geen verzoek naar de gemeente, daarna de gezinslid-weergave", async ({ page }) => {
  const ellen = lid("Ellen");
  await login(page, "ellen@example.com");
  try {
    await openSettings(page);
    const s = section(page);
    await fillAddress(page, "2591 BB", "87");
    await search(page);
    await expect(s.getByRole("heading", { name: T.t45 })).toBeVisible();

    await setRole(ellen.id, "member");
    await stubScenario("normaal"); // teller op 0
    await s.getByRole("button", { name: "Ja, aanzetten" }).click();
    await expectToast(page, T.t66);
    expect(await calendarRow(householdId)).toBeNull();
    expect(await wasteTasks(householdId)).toEqual([]);
    expect(await stubTotal(), "de server vraagt niets op na de weigering").toBe(0);
    // §18.11: FORBIDDEN → pagina naar J (gezinslid-weergave)
    await expect(s).toContainText(T.t39b);
  } finally {
    await setRole(ellen.id, "admin");
  }
});

test("AC-189: beheerder verliest zijn rol terwijl de sectie open staat → Uitzetten geeft T-66, adres en taken blijven, daarna de gezinslid-weergave", async ({ page }) => {
  const ellen = lid("Ellen");
  await insertCalendar(householdId);
  await insertWasteTask(householdId, day(2), "out");
  await login(page, "ellen@example.com");
  try {
    await openSettings(page);
    const s = section(page);
    await expect(s.getByRole("button", { name: T.t55 })).toBeVisible();

    await setRole(ellen.id, "member");
    await s.getByRole("button", { name: T.t55 }).click();
    await page.getByRole("dialog", { name: T.t80 }).getByRole("button", { name: "Uitzetten" }).click();
    await expectToast(page, T.t66);
    expect(await calendarRow(householdId)).not.toBeNull();
    expect(await wasteTasks(householdId)).toHaveLength(1);
    await expect(s).toContainText(T.t38b);
    await expect(s.getByRole("button")).toHaveCount(0);
  } finally {
    await setRole(ellen.id, "admin");
  }
});

// =============================================================================
// AC-204 — G′: één mislukte poging → alleen de stille regel
// =============================================================================
test("AC-204: één mislukte poging (UNREACHABLE) → G′ met T-71 en de bewaarde datums; ADDRESS_GONE → T-71b; geen balk", async ({ page, browser }) => {
  const kort = new Date(Date.now() - 10 * 60_000).toISOString();
  await insertCalendar(householdId, {
    last_success_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    last_error_code: "UNREACHABLE",
    error_since: kort,
    last_failure_at: kort,
  });
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await expect(s).toContainText(T.t71);
  await expect(s).not.toContainText(T.t37);
  await expect(s).not.toContainText(T.t76);
  await expect(s.getByRole("heading", { name: T.t50kop, exact: true })).toBeVisible();
  await expect(pickupRow(page, "Restafval")).toContainText(dag(day(2)));
  await expect(pickupRow(page, "PMD")).toContainText(dag(day(9)));

  await updateCalendar(householdId, { last_error_code: "ADDRESS_GONE" });
  await page.reload();
  await expect(s).toContainText(T.t71b);
  await expect(s).not.toContainText(T.t77c);

  const lynn = await alsGebruiker(browser, "lynn@example.com");
  try {
    await lynn.goto("/instellingen#afvalkalender");
    await expect(lynn.locator("#afvalkalender")).toContainText(T.t38b);
    await expect(lynn.locator("#afvalkalender")).not.toContainText(T.t71b);
  } finally {
    await lynn.context().close();
  }
});

// =============================================================================
// AC-205 — storing per oorzaak: H1, H2, H3
// =============================================================================
const uurGeleden = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

test("AC-205 H1: 48 uur niet gelukt (UNREACHABLE, stub onbereikbaar) → T-72, T-75, T-76, T-37, bewaarde datums onder 'stand <dag>'", async ({ page }) => {
  await stubScenario("onbereikbaar");
  const last = uurGeleden(49);
  await insertCalendar(householdId, { last_success_at: last, last_error_code: "UNREACHABLE", error_since: uurGeleden(1), last_failure_at: uurGeleden(1) });
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  // T-72: 49 uur geleden is altijd "<dag> hh:mm" (niet vandaag of gisteren)
  await expect(s).toContainText(`Aan · laatst bijgewerkt ${dagVan(last)} ${klok(last)}`);
  await expect(s.getByRole("status").filter({ hasText: `Niet bijgewerkt sinds ${dagVan(last)}` })).toBeVisible();
  await expect(s).toContainText(T.t76);
  await expect(s.getByText(T.t37, { exact: true })).toBeVisible();
  await expect(s.getByRole("heading", { name: `Volgende ophaaldagen · stand ${dagVan(last)}` })).toBeVisible();
  await expect(pickupRow(page, "Restafval")).toContainText(dag(day(2)));
  await expect(s.getByRole("button", { name: "Adres controleren" })).toHaveCount(0);
  await expect(s.getByRole("button", { name: "Opnieuw proberen" })).toBeVisible();
});

test("AC-205 H1 zonder foutcode: achtergrondtaak lag 48 uur stil → hetzelfde H1-beeld", async ({ page }) => {
  const last = uurGeleden(49);
  await insertCalendar(householdId, { last_success_at: last });
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await expect(s).toContainText(`Niet bijgewerkt sinds ${dagVan(last)}`);
  await expect(s).toContainText(T.t76);
});

test("AC-205 H2: twee lege antwoorden ≥ 60 min uit elkaar (stub leeg) → T-77 + T-77b, bewaarde datums blijven onder 'stand <dag>', geen T-45b", async ({ page }) => {
  await stubScenario("leeg");
  const last = uurGeleden(3);
  await insertCalendar(householdId, { last_success_at: last, last_error_code: "SUSPECT_EMPTY", error_since: uurGeleden(2), last_failure_at: uurGeleden(0.5) });
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await expect(s).toContainText(T.t77);
  await expect(s).toContainText(T.t77b);
  await expect(s.getByRole("heading", { name: `Volgende ophaaldagen · stand ${dagVan(last)}` })).toBeVisible();
  await expect(pickupRow(page, "Restafval")).toContainText(dag(day(2)));
  await expect(pickupRow(page, "Papier")).toContainText(dag(day(2)));
  await expect(pickupRow(page, "PMD")).toContainText(dag(day(9)));
  await expect(s).not.toContainText(T.t45b);
});

test("AC-205 H3: adres weg (stub B = {}) + 48 uur → T-77c, T-77d, knoppen Adres controleren en Opnieuw proberen; Adres controleren → A′ gevuld (T-47)", async ({ page, browser }) => {
  await stubScenario("adres_weg");
  await insertCalendar(householdId, { last_success_at: uurGeleden(49), last_error_code: "ADDRESS_GONE", error_since: uurGeleden(2), last_failure_at: uurGeleden(1) });
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await expect(s).toContainText(T.t77c);
  await expect(s).toContainText(T.t77d);
  await expect(s.getByRole("button", { name: "Opnieuw proberen" })).toBeVisible();
  await s.getByRole("button", { name: "Adres controleren" }).click();
  await expect(s.getByRole("heading", { name: T.t47titel })).toBeVisible();
  await expect(s).toContainText(T.t47);
  await expect(s.getByLabel("Postcode")).toHaveValue("2591 BB");
  await expect(s.getByLabel("Huisnummer")).toHaveValue("87");

  // Gezinslid: geen balk
  const lynn = await alsGebruiker(browser, "lynn@example.com");
  try {
    await lynn.goto("/instellingen#afvalkalender");
    const ls = lynn.locator("#afvalkalender");
    await expect(ls).toContainText(T.t38b);
    await expect(ls).not.toContainText(T.t77c);
    await expect(ls).not.toContainText(T.t37);
  } finally {
    await lynn.context().close();
  }
});

// =============================================================================
// AC-236 — Opnieuw proberen: bezig, (b) mislukt, (c) te snel, (a) gelukt; offline
// =============================================================================
test("AC-236: H1 → Opnieuw proberen: T-77e en knop uit → (b) T-78 in de balk → (c) T-79 zonder toast en zonder verzoek → (a) balk weg, T-70, T-94", async ({ page }) => {
  test.setTimeout(60_000);
  await insertCalendar(householdId, { last_success_at: uurGeleden(49), last_error_code: "UNREACHABLE", error_since: uurGeleden(2), last_failure_at: uurGeleden(1) });
  await stubScenario("onbereikbaar", 2_000);
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  const balk = s.getByRole("status").filter({ hasText: "Niet bijgewerkt sinds" });
  await expect(balk).toBeVisible();

  // Bezig: T-77e, knop uit, rest van de pagina bruikbaar
  await balk.getByRole("button", { name: "Opnieuw proberen" }).click();
  await expect(balk.getByRole("button", { name: T.t77e })).toBeDisabled();
  await expect(s.getByRole("button", { name: "Adres wijzigen" })).toBeEnabled();
  await expect(s.getByRole("button", { name: T.t55 })).toBeEnabled();

  // (b) nog steeds fout → T-78 in de balk, knop weer actief
  await expect(balk).toContainText(/Opnieuw geprobeerd om \d\d:\d\d\. Het lukt nog steeds niet\./, { timeout: 15_000 });
  await expect(balk.getByRole("button", { name: "Opnieuw proberen" })).toBeEnabled();
  expect(await stubTotal(), "(b) er ging een verzoek naar de gemeente").toBeGreaterThan(0);

  // (c) binnen 60 s opnieuw → T-79 in de balk, geen toast, geen verzoek
  await stubScenario("onbereikbaar"); // teller op 0
  await balk.getByRole("button", { name: "Opnieuw proberen" }).click();
  await expect(balk).toContainText(T.t79);
  await page.waitForTimeout(1_000);
  await expect(toasts(page)).toHaveCount(0);
  expect(await stubTotal(), "(c) geen verzoek naar de gemeente").toBe(0);

  // (a) na een minuut (claim vrijgeven in de testdatabase) en bron weer in orde → balk weg
  await updateCalendar(householdId, { last_attempt_at: null });
  await stubScenario("normaal");
  await balk.getByRole("button", { name: "Opnieuw proberen" }).click();
  await expectToast(page, T.t94);
  await expect(s.getByRole("status").filter({ hasText: "Niet bijgewerkt sinds" })).toHaveCount(0);
  await expect(s).toContainText(/Aan · bijgewerkt vandaag \d\d:\d\d/);
  await expect(s.getByText(T.t37, { exact: true })).toHaveCount(0);
  expect(await stubTotal()).toBeGreaterThan(0);
  expect(await calendarRow(householdId)).toMatchObject({ last_error_code: null, alarm_since: null });
});

test("AC-236 offline: knoppen uit met T-67", async ({ page, context }) => {
  await insertCalendar(householdId, { last_success_at: uurGeleden(49), last_error_code: "UNREACHABLE", error_since: uurGeleden(2), last_failure_at: uurGeleden(1) });
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await expect(s.getByRole("button", { name: "Opnieuw proberen" })).toBeEnabled();
  await context.setOffline(true);
  try {
    await expect(s.getByRole("button", { name: "Opnieuw proberen" })).toBeDisabled();
    await expect(s.getByRole("button", { name: T.t55 })).toBeDisabled();
    await expect(s.getByText(T.t67).first()).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

// =============================================================================
// AC-213 — uitzetten
// =============================================================================
test("AC-213: uitzetten met 4 open taken → T-80 + T-81; Annuleren verandert niets; Uitzetten → T-93 zonder Ongedaan maken, adres en open taken weg, gedaan blijft", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await enableViaUi(page);
  const oudGedaan = await insertWasteTask(householdId, day(-3), "out", "rest", "done");
  await page.reload();
  const s = section(page);

  await s.getByRole("button", { name: T.t55 }).click();
  let dialog = page.getByRole("dialog", { name: T.t80 });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(T.t81_4);
  await dialog.getByRole("button", { name: "Annuleren" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await calendarRow(householdId)).not.toBeNull();
  expect((await wasteTasks(householdId)).filter((t) => t.status === "todo")).toHaveLength(4);

  await s.getByRole("button", { name: T.t55 }).click();
  dialog = page.getByRole("dialog", { name: T.t80 });
  await dialog.getByRole("button", { name: "Uitzetten" }).click();
  const toast = toasts(page).filter({ hasText: T.t93 });
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button", { name: "Ongedaan maken" })).toHaveCount(0);

  expect(await calendarRow(householdId)).toBeNull();
  const na = await wasteTasks(householdId);
  expect(na.map((t) => ({ id: t.id, status: t.status }))).toEqual([{ id: oudGedaan.id, status: "done" }]);
  // Terug naar A
  await expect(s.getByRole("button", { name: "Adres zoeken" })).toBeVisible();
});

test("AC-213: uitzetten zonder open afvaltaken → T-81c, zonder '(0 taken)'", async ({ page }) => {
  await insertCalendar(householdId);
  await login(page, "jurgen@example.com");
  await openSettings(page);
  await section(page).getByRole("button", { name: T.t55 }).click();
  const dialog = page.getByRole("dialog", { name: T.t80 });
  await expect(dialog).toContainText(T.t81c);
  await expect(dialog).not.toContainText("0 afvaltaken");
  await expect(dialog).not.toContainText("0 taken");
  await expect(dialog.getByRole("button", { name: "Uitzetten" })).toBeVisible();
  await dialog.getByRole("button", { name: "Annuleren" }).click();
  expect(await calendarRow(householdId)).not.toBeNull();
});

// =============================================================================
// AC-215 — tip T-54 één keer
// =============================================================================
test("AC-215: tip T-54 na het aanzetten; wegtikken → komt niet terug", async ({ page }) => {
  await insertCalendar(householdId);
  await login(page, "jurgen@example.com");
  await openSettings(page);
  const s = section(page);
  await expect(s).toContainText(T.t54);
  await s.getByRole("button", { name: "Tip sluiten" }).click();
  await expect(s).not.toContainText(T.t54);
  await page.reload();
  await expect(s.getByRole("button", { name: "Adres wijzigen" })).toBeVisible();
  await expect(s).not.toContainText(T.t54);
});

// =============================================================================
// AC-223 — de storingsmelding opent de juiste plek
// =============================================================================
test("AC-223: /instellingen/afvalkalender → sectie Afvalkalender in beeld; storingsmelding (label T-39c) opent dezelfde plek", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await page.goto("/instellingen/afvalkalender");
  await expect(page).toHaveURL(/\/instellingen#afvalkalender$/);
  await expect(section(page).getByRole("heading", { name: "Afvalkalender", level: 2 })).toBeInViewport();

  const titel = "De afvalkalender kon niet worden bijgewerkt";
  const { error } = await adminDb()
    .from("notifications")
    .insert({
      household_id: householdId,
      member_id: lid("Jurgen").id,
      type: "waste_sync_failed",
      title: titel,
      body: `Laatst gelukt op ${dag(day(-2))}. Nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl.`,
      url: "/instellingen/afvalkalender",
      dedupe_key: `e2e-waste-failed:${Date.now()}`,
    } as never);
  expect(error).toBeNull();
  try {
    await page.goto("/meldingen");
    const melding = page.getByRole("button", { name: new RegExp(titel) }).first();
    await expect(melding).toBeVisible();
    await expect(melding.getByLabel("Afvalkalender")).toBeVisible();
    await melding.click();
    await expect(page).toHaveURL(/\/instellingen#afvalkalender$/);
    await expect(section(page).getByRole("heading", { name: "Afvalkalender", level: 2 })).toBeInViewport();
  } finally {
    await adminDb().from("notifications").delete().eq("household_id", householdId).eq("type", "waste_sync_failed");
  }
});

// =============================================================================
// AC-192 / AC-193 / AC-208 — afvaltaken in lijst en detail
// =============================================================================
test.describe("afvaltaken in de lijst en het detail (ophaaldag morgen, restafval)", () => {
  let D: string;
  test.beforeEach(async () => {
    D = day(1);
    await insertWasteTask(householdId, D, "out");
    await insertWasteTask(householdId, D, "in");
  });

  test("AC-192/193: vandaag 19:30 (D−1) → buitenzetten onder Vandaag met 'vanaf 22:00' (T-16), zonder '21:00' of deadlinebadge; binnenzetten onder Binnenkort 'Morgen'", async ({ page }) => {
    await login(page, "jurgen@example.com");
    await page.clock.setFixedTime(new Date(amsterdam(day(0), "19:30")));
    await page.goto("/");
    const vandaag = page.locator("section").filter({ has: page.getByRole("heading", { name: /Vandaag/ }) });
    const buiten = vandaag.getByRole("button", { name: /Restafval buitenzetten/ }).first();
    await expect(buiten).toBeVisible();
    await expect(buiten).toContainText(T.t15);
    await expect(buiten).toContainText(T.t16);
    await expect(buiten).not.toContainText("21:00");
    await expect(buiten).not.toContainText(/verloopt|uiterlijk/i);

    const binnenkort = page.locator("section").filter({ has: page.getByRole("heading", { name: /Binnenkort/ }) });
    const binnen = binnenkort.getByRole("button", { name: /Restafvalbak binnenzetten/ }).first();
    await expect(binnen).toBeVisible();
    await expect(binnen).toContainText("Morgen");
    await expect(binnen).toContainText(T.t15);
  });

  test("AC-192/208: detail buitenzetten (beheerder, herinneringen aan) → T-20, T-21, T-22, T-25, T-27; ⋯-menu zonder bewerken, verplaatsen of verwijderen", async ({ page }) => {
    await login(page, "jurgen@example.com");
    await page.clock.setFixedTime(new Date(amsterdam(day(0), "19:30")));
    await page.goto("/");
    await page.getByRole("button", { name: /Restafval buitenzetten/ }).first().click();
    const detail = page.getByRole("dialog");
    await expect(detail.getByRole("heading", { name: "Restafval buitenzetten" })).toBeVisible();
    await expect(detail).toContainText(`Afvalkalender · ophaaldag ${dag(D)}`);
    await expect(detail).toContainText("Mag buiten");
    await expect(detail).toContainText(`${dag(day(0))} vanaf 22:00`);
    await expect(detail).toContainText("Uiterlijk");
    await expect(detail).toContainText(`${dag(D)} 07:45`);
    await expect(detail).toContainText("Herinnering");
    await expect(detail).toContainText(`${dag(day(0))} 21:00`);
    await expect(detail).toContainText(T.t27);
    await expect(detail.getByLabel("Verplaatsen naar")).toHaveCount(0);

    await detail.getByRole("button", { name: "Meer acties" }).click();
    const items = page.getByRole("menuitem");
    await expect(items).toHaveText([/Ik ben ermee bezig/, /Deze keer overslaan/]);
    await expect(page.getByRole("menuitem", { name: /Bewerken|Verwijderen|Verplaatsen/ })).toHaveCount(0);
  });

  test("AC-193: morgen 09:10 (D) → binnenzetten bovenaan Binnenkort met 'vanaf 12:00' (T-18); buitenzetten onder Verlopen met alleen '… te laat'", async ({ page }) => {
    await login(page, "jurgen@example.com");
    await page.clock.setFixedTime(new Date(amsterdam(D, "09:10")));
    await page.goto("/");
    const binnenkort = page.locator("section").filter({ has: page.getByRole("heading", { name: /Binnenkort/ }) });
    const binnen = binnenkort.getByRole("button", { name: /Restafvalbak binnenzetten/ }).first();
    await expect(binnen).toBeVisible();
    await expect(binnen).toContainText(T.t18);
    await expect(binnenkort.getByRole("button").first()).toContainText("Restafvalbak binnenzetten");

    const verlopen = page.locator("section").filter({ has: page.getByRole("heading", { name: /Verlopen/ }) });
    const buiten = verlopen.getByRole("button", { name: /Restafval buitenzetten/ }).first();
    await expect(buiten).toBeVisible();
    await expect(buiten).toContainText(/te laat/);
    await expect(buiten).not.toContainText(T.t16);
    await expect(buiten).not.toContainText(T.t17);
  });

  test("AC-193: detail binnenzetten → T-23 en T-24, zonder omschrijving", async ({ page }) => {
    await login(page, "jurgen@example.com");
    await page.goto("/taken");
    await page.getByPlaceholder("Zoek een taak").fill("Restafvalbak binnenzetten");
    await page.getByText("Restafvalbak binnenzetten").first().click();
    const detail = page.getByRole("dialog");
    await expect(detail).toContainText(`Afvalkalender · ophaaldag ${dag(D)}`);
    await expect(detail).toContainText("Binnenzetten");
    await expect(detail).toContainText(`${dag(D)} vanaf 12:00`);
    await expect(detail).toContainText(`${dag(D)}, einde van de dag`);
    await expect(detail).toContainText(T.t27);
  });

  test("AC-192: ophaaldag 07:00 (D) → buitenzetten onder Vandaag met 'vóór 07:45' (T-17), zonder '21:00'", async ({ page }) => {
    await login(page, "jurgen@example.com");
    await page.clock.setFixedTime(new Date(amsterdam(D, "07:00")));
    await page.goto("/");
    const vandaag = page.locator("section").filter({ has: page.getByRole("heading", { name: /Vandaag/ }) });
    const buiten = vandaag.getByRole("button", { name: /Restafval buitenzetten/ }).first();
    await expect(buiten).toBeVisible();
    await expect(buiten).toContainText(T.t17);
    await expect(buiten).not.toContainText("21:00");
  });

  test("AC-192 / D-048: afvaltaken tellen niet mee in 'Eerstvolgende deadline' op Vandaag", async ({ page }) => {
    await login(page, "jurgen@example.com");
    await page.clock.setFixedTime(new Date(amsterdam(day(0), "19:30")));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Vandaag/ })).toBeVisible();
    const deadline = page.getByText(/Eerstvolgende deadline/);
    if (await deadline.count()) {
      await expect(deadline).not.toContainText(/Restafval buitenzetten|Restafvalbak binnenzetten/);
    }
  });

  test("AC-192 / D-048: dagweergave van de Kalender toont 'vanaf 22:00' bij buitenzetten en nergens '21:00'", async ({ page }) => {
    await login(page, "jurgen@example.com");
    await page.goto("/kalender");
    await page.getByRole("tab", { name: "Dag" }).click();
    const buiten = page.getByRole("button", { name: /Restafval buitenzetten/ }).first();
    await expect(buiten).toBeVisible();
    await expect(buiten).toContainText(T.t16);
    await expect(buiten).not.toContainText("21:00");
  });

  test("AC-192 / D-048: dagweergave → 'Volgende dag' (binnen het scherm van 390 px) → binnenzetten met 'vanaf 12:00'", async ({ page }) => {
    await login(page, "jurgen@example.com");
    await page.goto("/kalender");
    await page.getByRole("tab", { name: "Dag" }).click();
    await expect(page.getByRole("button", { name: /Restafval buitenzetten/ }).first()).toBeVisible();
    const volgende = page.getByRole("button", { name: "Volgende dag" });
    await expect(volgende).toBeInViewport();
    await volgende.click();
    const binnen = page.getByRole("button", { name: /Restafvalbak binnenzetten/ }).first();
    await expect(binnen).toBeVisible();
    await expect(binnen).toContainText(T.t18);
  });

  test("AC-192 / D-048: detail van een verlopen buitenzet-taak → 'Uiterlijk' met '… te laat'", async ({ page }) => {
    await login(page, "jurgen@example.com");
    await page.clock.setFixedTime(new Date(amsterdam(D, "09:10")));
    await page.goto("/");
    const verlopen = page.locator("section").filter({ has: page.getByRole("heading", { name: /Verlopen/ }) });
    await verlopen.getByRole("button", { name: /Restafval buitenzetten/ }).first().click();
    const detail = page.getByRole("dialog");
    await expect(detail).toContainText("Uiterlijk");
    await expect(detail).toContainText(`${dag(D)} 07:45`);
    await expect(detail).toContainText(/te laat/);
    await expect(detail).toContainText(T.t27);
  });

  test("AC-207: Lynn vinkt binnenzetten af terwijl buitenzetten open staat → alleen binnenzetten gedaan; Ongedaan maken → weer open, buitenzetten ongewijzigd", async ({ page }) => {
    const [buiten, binnen] = await wasteTasks(householdId).then((ts) => [ts.find((t) => t.waste_direction === "out")!, ts.find((t) => t.waste_direction === "in")!]);
    await login(page, "lynn@example.com");
    await page.goto("/taken");
    await page.getByPlaceholder("Zoek een taak").fill("Restafvalbak binnenzetten");
    await page.getByLabel("Restafvalbak binnenzetten afvinken").first().click();
    const status = async (id: string) => (await adminDb().from("tasks").select("status").eq("id", id).single()).data?.status;
    await expect.poll(() => status(binnen.id)).toBe("done");
    expect(await status(buiten.id)).toBe("todo");

    await toasts(page).getByRole("button", { name: "Ongedaan maken" }).first().click();
    await expect.poll(() => status(binnen.id)).toBe("todo");
    expect(await status(buiten.id)).toBe("todo");
  });

  test("AC-211: Lynn (herinneringen uit) ziet in het detail geen rij 'Herinnering', en ook geen '(uit)'", async ({ page }) => {
    const lynn = lid("Lynn");
    const prefs = await adminDb().from("user_preferences").update({ notify_reminders: false } as never).eq("member_id", lynn.id).select("member_id");
    expect(prefs.error).toBeNull();
    await login(page, "lynn@example.com");
    await page.clock.setFixedTime(new Date(amsterdam(day(0), "19:30")));
    await page.goto("/");
    await page.getByRole("button", { name: /Restafval buitenzetten/ }).first().click();
    const detail = page.getByRole("dialog");
    await expect(detail).toContainText("Mag buiten");
    await expect(detail).not.toContainText("Herinnering");
    await expect(detail).not.toContainText("(uit)");
  });

  // ===========================================================================
  // AC-209 — buitenzetten overslaan neemt binnenzetten mee; Ongedaan maken
  // ===========================================================================
  test("AC-209: Lynn slaat buitenzetten over → T-31 met Ongedaan maken, beide overgeslagen; Ongedaan maken → beide weer open", async ({ page }) => {
    const [buiten, binnen] = await wasteTasks(householdId).then((ts) => [ts.find((t) => t.waste_direction === "out")!, ts.find((t) => t.waste_direction === "in")!]);
    await login(page, "lynn@example.com");
    await page.goto("/");
    await page.getByRole("button", { name: /Restafval buitenzetten/ }).first().click();
    const detail = page.getByRole("dialog");
    await detail.getByRole("button", { name: "Meer acties" }).click();
    await page.getByRole("menuitem", { name: /Deze keer overslaan/ }).click();

    const toast = toasts(page).filter({ hasText: T.t31 });
    await expect(toast).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0); // zonder bevestiging
    const status = async (id: string) => (await adminDb().from("tasks").select("status").eq("id", id).single()).data?.status;
    await expect.poll(() => status(buiten.id)).toBe("skipped");
    await expect.poll(() => status(binnen.id)).toBe("skipped");

    await toast.getByRole("button", { name: "Ongedaan maken" }).click();
    await expect.poll(() => status(buiten.id)).toBe("todo");
    await expect.poll(() => status(binnen.id)).toBe("todo");
  });

  test("AC-209 (na sluiten van het detail): Ongedaan maken in de melding zet beide taken weer open", async ({ page }) => {
    const [buiten, binnen] = await wasteTasks(householdId).then((ts) => [ts.find((t) => t.waste_direction === "out")!, ts.find((t) => t.waste_direction === "in")!]);
    await login(page, "lynn@example.com");
    await page.goto("/");
    await page.getByRole("button", { name: /Restafval buitenzetten/ }).first().click();
    const detail = page.getByRole("dialog");
    await detail.getByRole("button", { name: "Meer acties" }).click();
    await page.getByRole("menuitem", { name: /Deze keer overslaan/ }).click();
    const toast = toasts(page).filter({ hasText: T.t31 });
    await expect(toast).toBeVisible();
    const status = async (id: string) => (await adminDb().from("tasks").select("status").eq("id", id).single()).data?.status;
    await expect.poll(() => status(binnen.id)).toBe("skipped");

    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);
    await toast.getByRole("button", { name: "Ongedaan maken" }).click();
    await expect.poll(() => status(buiten.id)).toBe("todo");
    await expect.poll(() => status(binnen.id)).toBe("todo");
  });
});

function dagVan(instant: string): string {
  return dag(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date(instant)));
}
