import { expect, test } from "@playwright/test";

test("nieuw account → huishouden inrichten → dashboard; ziet niets van een ander huishouden", async ({ page }) => {
  const email = `nieuw-${Date.now()}@example.com`;
  await page.goto("/login?mode=register");
  await page.getByLabel("Je naam").fill("Sanne");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord").fill("Geheim1234!");
  await page.getByRole("button", { name: "Account aanmaken" }).click();
  await page.waitForURL(/onboarding/);

  // Stap 1
  await page.getByLabel("Hoe heet je huishouden?").fill("Huize Zonnebloem");
  await page.getByRole("button", { name: /Volgende/ }).click();
  // Stap 2: gezinslid toevoegen
  await page.getByLabel("Naam van gezinslid").fill("Tim");
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect(page.getByText("Tim")).toBeVisible();
  await page.getByRole("button", { name: /Volgende/ }).click();
  // Stap 3-5: standaard aangevinkte taken, frequentie en verdeling accepteren
  for (const heading of [/Welke taken/, /Hoe vaak/, /Hoe verdelen/]) {
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    await page.getByRole("button", { name: /Volgende|Verder|Klaar/ }).last().click();
  }
  await expect(page.getByText(/Je huishouden is klaar/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Naar|Aan de slag|Start/ }).first().click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sanne");
  await expect(page.getByText("Huize Zonnebloem")).toBeVisible();

  // Isolatie: taken en boodschappen van "Familie" zijn niet zichtbaar
  await page.goto("/taken");
  await page.getByRole("button", { name: "Alles" }).click();
  await expect(page.getByText("Fietsband plakken")).toHaveCount(0);
  await page.goto("/boodschappen");
  await expect(page.getByText("Toiletpapier")).toHaveCount(0);
});
