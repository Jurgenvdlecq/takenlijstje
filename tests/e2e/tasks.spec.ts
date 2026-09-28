import { expect, test } from "@playwright/test";
import { expectToast, login } from "./helpers";
import { adminDb, todayAmsterdam } from "./support/db";

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

  // WP2a: snelle invoer herkent geen persoon meer; de taak is van het huishouden (V-21)
  test("snelle invoer: 'Planten water geven morgen' → taak voor morgen, zonder persoon", async ({ page }) => {
    const title = `Planten water geven ${Date.now() % 100000}`;
    await page.getByLabel("Snel een taak toevoegen").fill(`${title} morgen`);
    await expect(page.getByText("Morgen", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
    await expectToast(page, new RegExp(`${title}.*toegevoegd`));
    // select("*"): na WP2b bestaat de kolom niet meer; dan is hij hier undefined
    const { data } = await adminDb().from("tasks").select("*").eq("title", title).single();
    const row = data as Record<string, unknown>;
    expect(row.scheduled_date).toBe(todayAmsterdam(1));
    expect(row.assigned_member_id ?? null).toBeNull();
    await page.goto("/taken");
    const card = page.getByText(title).first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByRole("dialog")).toContainText(title);
    await expect(page.getByLabel("Toewijzen aan")).toHaveCount(0);
  });

  test("nieuwe terugkerende taak via + Taak", async ({ page }) => {
    await page.getByRole("button", { name: "Nieuwe taak" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Naam taak").fill("Ramen lappen");
    await dialog.getByRole("switch").click(); // Herhalen
    await dialog.getByRole("button", { name: "Elke 2 weken" }).click();
    await expect(dialog.getByText(/Elke 2 weken op/)).toBeVisible();
    // WP2a: geen verdeling meer (V-21)
    await expect(dialog.getByRole("button", { name: "Om en om" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Toevoegen" }).click();
    await expectToast(page, "Terugkerende taak ingepland");

    await page.goto("/taken");
    await page.getByPlaceholder("Zoek een taak").fill("Ramen lappen");
    await expect(page.getByText("Ramen lappen").first()).toBeVisible();
    await page.getByText("Ramen lappen").first().click();
    await expect(page.getByRole("dialog")).toContainText(/Elke 2 weken op/);
  });

  // WP2a: ruilen is vervallen (V-21); de meldingenpagina heeft geen "Overnemen" meer
  test("meldingen: geen ruilverzoeken of 'Overnemen'", async ({ page }) => {
    await page.goto("/meldingen");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Overnemen" })).toHaveCount(0);
    await expect(page.getByText(/ruil/i)).toHaveCount(0);
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
