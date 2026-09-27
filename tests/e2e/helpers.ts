import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Welkom123!";

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord").fill(password);
  await page.locator("form").getByRole("button", { name: "Inloggen" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** De kaart van een taak op het huidige scherm */
export function taskCard(page: Page, title: string) {
  return page.getByRole("button", { name: new RegExp(title) }).filter({ has: page.getByLabel(`${title} afvinken`) }).first();
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}
