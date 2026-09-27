import { expect, test } from "@playwright/test";
import { expectToast, login } from "./helpers";

test.describe("taken (Jurgen)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "jurgen@example.com");
  });

  test("dashboard toont begroeting, samenvatting en secties", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Goede(morgen|middag|navond), Jurgen/);
    await expect(page.getByText("vandaag", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Vandaag/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Verlopen/ })).toBeVisible();
    await expect(page.getByText("Fietsband plakken").first()).toBeVisible();
  });

  test("afvinken met één tik en ongedaan maken", async ({ page }) => {
    const overdue = page.getByRole("heading", { name: /Verlopen/ });
    await page.getByLabel("Fietsband plakken afvinken").first().click();
    await expectToast(page, "Taak voltooid");
    // Afgevinkt → niet meer verlopen
    await expect(overdue).toHaveCount(0);
    await page.locator("[data-sonner-toast]").getByRole("button", { name: "Ongedaan maken" }).first().click();
    await expect(page.getByLabel("Fietsband plakken afvinken").first()).toBeVisible();
    await expect(overdue).toBeVisible();

    // Opnieuw afvinken; na herladen is het nog steeds gedaan (opgeslagen op de server)
    await page.getByLabel("Fietsband plakken afvinken").first().click();
    await expectToast(page, "Taak voltooid");
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Jurgen");
    await expect(overdue).toHaveCount(0);
  });

  test("snelle invoer: 'Planten water geven morgen Ellen'", async ({ page }) => {
    await page.getByLabel("Snel een taak toevoegen").fill("Planten water geven morgen Ellen");
    await expect(page.getByText("Morgen", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
    await expectToast(page, /Planten water geven.*toegevoegd/);
    await page.goto("/taken");
    const card = page.getByText("Planten water geven").first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByRole("dialog")).toContainText("Planten water geven");
    await expect(page.getByLabel("Toewijzen aan")).toHaveValue(/.+/);
    await expect(page.getByLabel("Toewijzen aan").locator("option:checked")).toHaveText("Ellen");
  });

  test("nieuwe terugkerende taak via + Taak", async ({ page }) => {
    await page.getByRole("button", { name: "Nieuwe taak" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Naam taak").fill("Ramen lappen");
    await dialog.getByRole("button", { name: "Om en om" }).waitFor({ state: "detached" }).catch(() => {});
    await dialog.getByRole("switch").click(); // Herhalen
    await dialog.getByRole("button", { name: "Elke 2 weken" }).click();
    await expect(dialog.getByText(/Elke 2 weken op/)).toBeVisible();
    await dialog.getByRole("button", { name: "Om en om" }).click();
    await dialog.getByRole("button", { name: "Toevoegen" }).click();
    await expectToast(page, "Terugkerende taak ingepland");

    await page.goto("/taken");
    await page.getByPlaceholder("Zoek een taak").fill("Ramen lappen");
    await expect(page.getByText("Ramen lappen").first()).toBeVisible();
    await page.getByText("Ramen lappen").first().click();
    await expect(page.getByRole("dialog")).toContainText(/Elke 2 weken op/);
  });

  test("taak ruilen: overnemen vanuit meldingen", async ({ page }) => {
    await page.goto("/meldingen");
    const takeOver = page.getByRole("button", { name: "Overnemen" }).first();
    await expect(takeOver).toBeVisible();
    await takeOver.click();
    await expectToast(page, "Taak overgenomen");
  });

  test("boodschappen toevoegen en afvinken", async ({ page }) => {
    await page.goto("/boodschappen");
    const product = `Hagelslag ${Date.now() % 10000}`;
    await page.getByPlaceholder(/Wat moet er gehaald worden/).fill(`3 pakken ${product.toLowerCase()}`);
    await page.keyboard.press("Enter");
    await expect(page.getByText(product)).toBeVisible();
    await page.getByText(product).click();
    await expect(page.getByText("In je mandje")).toBeVisible();
  });

  test("opmerking bij taak → boodschappenlijst", async ({ page }) => {
    await page.goto("/taken");
    await page.getByPlaceholder("Zoek een taak").fill("WC schoonmaken");
    await page.getByText("WC schoonmaken").first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nieuwe opmerking").fill("Sponsjes zijn op");
    await dialog.getByRole("button", { name: "Plaatsen" }).click();
    await expect(dialog.getByText("Sponsjes zijn op")).toBeVisible();
    await dialog.getByText("Sponsjes zijn op").locator("..").getByRole("button", { name: /boodschappenlijst/ }).click();
    await expectToast(page, /Sponsjes.*boodschappenlijst/);
  });

  test("offline afvinken wordt later gesynchroniseerd", async ({ page, context }) => {
    await page.goto("/");
    const title = "Tandartsafspraak Kai maken";
    await expect(page.getByLabel(`${title} afvinken`).first()).toBeVisible();
    await context.setOffline(true);
    await page.getByLabel(`${title} afvinken`).first().click();
    await expectToast(page, "Opgeslagen op dit apparaat");
    await expect(page.getByText(/wijziging wacht/)).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText(/wijziging wacht/)).toHaveCount(0, { timeout: 15_000 });
    await page.reload();
    await expect(page.getByLabel(`${title}: afvinken ongedaan maken`).first()).toBeVisible();
  });
});
