/**
 * W-03 afvalkalender in de huidige schermen (390×844; ACCEPTANCE_CRITERIA AC-183,
 * AC-184, AC-185, AC-187, AC-189, AC-190, AC-192, AC-193, AC-205, AC-208, AC-209,
 * AC-213, AC-217; UX_SPEC §13). Vereist de lokale stack met de afval-stub
 * (tests/e2e/support/local-stack.sh) en een app die draait met
 * WASTE_SOURCE_BASE_URL=http://127.0.0.1:4010. Rook-screenshots naar docs/screenshots/wp3b.
 */
import { expect, test, type Page } from "@playwright/test";
import { expectToast, login } from "./helpers";
import { adminDb, familie } from "./support/db";

const SHOTS = "docs/screenshots/wp3b";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}-390x844.png`, fullPage: false });
}

async function afvalSectie(page: Page) {
  await page.goto("/instellingen#afvalkalender");
  const sectie = page.locator("section#afvalkalender");
  await expect(sectie).toBeVisible();
  await sectie.scrollIntoViewIfNeeded();
  return sectie;
}

async function zoek(page: Page, postcode: string, huisnummer: string) {
  await page.getByLabel("Postcode").fill(postcode);
  await page.getByLabel("Huisnummer").fill(huisnummer);
  await page.getByRole("button", { name: "Adres zoeken" }).click();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { householdId } = await familie();
  // Schone start: geen adres en geen open afvaltaken van een vorige run
  await adminDb().from("tasks").delete().eq("household_id", householdId).not("waste_direction", "is", null);
  await adminDb().from("waste_calendars").delete().eq("household_id", householdId);
});

test("AC-184/185/187/183: beheerder vult in, ziet fouten, kiest en zet aan", async ({ page }) => {
  await login(page, "jurgen@example.com");
  const sectie = await afvalSectie(page);
  await expect(sectie.getByRole("button", { name: "Adres zoeken" })).toBeDisabled();
  await shot(page, "instellingen-A-leeg");

  // Vorm (AC-184): fout bij het veld, niets opgevraagd
  await page.getByLabel("Postcode").fill("0123");
  await page.getByLabel("Huisnummer").click();
  await expect(sectie.getByText("Vul een postcode in zoals 2517 AB")).toBeVisible();

  // Onbekend (AC-185)
  await zoek(page, "2288 GH", "5");
  await expect(sectie.getByText(/Dit adres staat niet in de huisvuilkalender van Den Haag/)).toBeVisible();

  // Meerdere adressen (AC-187): de app kiest niet zelf
  await zoek(page, "2511ab", "12");
  await expect(sectie.getByText("Op nummer 12 staan meerdere adressen. Welke is van jullie?")).toBeVisible();
  await sectie.getByLabel("12A").check();
  await sectie.getByRole("button", { name: "Verder" }).click();
  await expect(sectie.getByText("Klopt dit?")).toBeVisible();
  await expect(sectie.getByText("Proefweg 12A, Den Haag")).toBeVisible();
  await sectie.getByRole("button", { name: "Ander adres" }).click();

  // Gevonden (AC-183): Klopt dit? → Ja, aanzetten
  await zoek(page, "2591 BB", "87");
  await expect(sectie.getByText("Teststraat 87, Den Haag")).toBeVisible();
  await shot(page, "instellingen-C-klopt-dit");
  await sectie.getByRole("button", { name: "Ja, aanzetten" }).click();
  await expectToast(page, /Afvalkalender staat aan/);
  await expect(sectie.getByText("2591 BB 87")).toBeVisible();
  await shot(page, "instellingen-G-aan");

  const { householdId } = await familie();
  const { count } = await adminDb().from("tasks").select("id", { count: "exact", head: true }).eq("household_id", householdId).not("waste_direction", "is", null);
  expect(count).toBeGreaterThanOrEqual(4);
});

test("AC-192/193/208/209: Vandaag en taakdetail; overslaan neemt binnenzetten mee", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await page.goto("/");
  const rij = page.getByRole("button", { name: /Restafval en papier buitenzetten/ }).first();
  await expect(rij).toBeVisible();
  await expect(rij.getByText("vanaf 22:00")).toBeVisible();
  await expect(rij.getByText("Afvalkalender")).toBeVisible();
  await expect(rij.getByText("21:00")).toHaveCount(0);
  await shot(page, "vandaag-afval");

  await rij.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(/De ophaaldag komt uit de afvalkalender van de gemeente/)).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Meer acties" })).toHaveCount(0);
  await expect(sheet.getByText("(verplaatsen)")).toHaveCount(0);
  await shot(page, "taakdetail-buitenzetten");

  await sheet.getByRole("button", { name: "Deze keer overslaan" }).click();
  await expectToast(page, "Overgeslagen, ook het binnenzetten");
  const { householdId } = await familie();
  await expect
    .poll(async () => {
      const { data } = await adminDb().from("tasks").select("status, waste_direction").eq("household_id", householdId).not("waste_direction", "is", null).order("waste_pickup_date").limit(2);
      return data?.map((t) => `${t.waste_direction}:${t.status}`).join(",");
    })
    .toBe("out:skipped,in:skipped");
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Ongedaan maken" }).click();
  await expect
    .poll(async () => {
      const { data } = await adminDb().from("tasks").select("status").eq("household_id", householdId).not("waste_direction", "is", null).order("waste_pickup_date").limit(2);
      return data?.map((t) => t.status).join(",");
    })
    .toBe("todo,todo");
});

test("AC-189/190: een gezinslid ziet alleen dat hij aan staat", async ({ page }) => {
  await login(page, "lynn@example.com");
  const sectie = await afvalSectie(page);
  await expect(sectie.getByText("Afvalkalender staat aan")).toBeVisible();
  await expect(sectie.getByLabel("Postcode")).toHaveCount(0);
  await expect(sectie.getByText("2591 BB 87")).toHaveCount(0);
  await shot(page, "instellingen-J-gezinslid");
});

test("AC-205: storing langer dan 48 uur → rustige balk met Opnieuw proberen", async ({ page }) => {
  const { householdId } = await familie();
  await adminDb()
    .from("waste_calendars")
    .update({ last_success_at: new Date(Date.now() - 50 * 3600_000).toISOString(), last_error_code: "UNREACHABLE", failure_count: 4 })
    .eq("household_id", householdId);
  await login(page, "jurgen@example.com");
  const sectie = await afvalSectie(page);
  await expect(sectie.getByText(/Niet bijgewerkt sinds/)).toBeVisible();
  await expect(sectie.getByRole("button", { name: "Opnieuw proberen" })).toBeVisible();
  await shot(page, "instellingen-H-storing");
});

test("AC-213: uitzetten vraagt bevestiging; annuleren verandert niets", async ({ page }) => {
  await login(page, "jurgen@example.com");
  const sectie = await afvalSectie(page);
  await sectie.getByRole("button", { name: "Afvalkalender uitzetten…" }).click();
  await expect(page.getByRole("dialog").getByText("Afvalkalender uitzetten?")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Annuleren" }).click();
  await expect(sectie.getByText("2591 BB 87")).toBeVisible();
  await sectie.getByRole("button", { name: "Afvalkalender uitzetten…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Uitzetten" }).click();
  await expectToast(page, "Afvalkalender staat uit");
  const { householdId } = await familie();
  const { data } = await adminDb().from("waste_calendars").select("household_id").eq("household_id", householdId);
  expect(data).toEqual([]);
});
