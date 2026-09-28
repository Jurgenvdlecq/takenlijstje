/**
 * WP1 — regressietests na de herreviews (D-032, commit c6ddff7) en de
 * beveiligingsheaders (D-018). Vereist een build die c6ddff7 bevat.
 */
import { expect, test } from "@playwright/test";
import { expectToast, login } from "./helpers";
import { adminDb, createLooseTask, familie, todayAmsterdam } from "./support/db";

// =============================================================================
// D-018: beveiligingsheaders op elke respons
// =============================================================================
test.describe("D-018: X-Frame-Options en CSP frame-ancestors", () => {
  for (const path of ["/login", "/", "/taken", "/geen-toegang", "/api/status", "/api/outbox", "/sw.js", "/icons/icon.svg", "/bestaat-niet"]) {
    test(`${path} kan niet in een frame worden geladen`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      const headers = res.headers();
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["content-security-policy"]).toMatch(/frame-ancestors 'none'/);
      expect(headers["x-content-type-options"]).toBe("nosniff");
    });
  }

  test("ook een ingelogde pagina en een POST op /api/outbox", async ({ page }) => {
    await login(page, "jurgen@example.com");
    const doc = await page.goto("/");
    expect(doc?.headers()["x-frame-options"]).toBe("DENY");
    expect(doc?.headers()["content-security-policy"]).toMatch(/frame-ancestors 'none'/);
    const res = await page.request.post("/api/outbox", { data: "{}", headers: { "content-type": "text/plain" } });
    expect(res.headers()["x-frame-options"]).toBe("DENY");
  });
});

// =============================================================================
// Security N1 (D-032): losse taak wordt terugkerend, maar de reeks-id is al bezet
// =============================================================================
test("N1: reeks met dezelfde id door een ander lid gemaakt → CONFLICT, taak blijft los", async ({ page }) => {
  const db = adminDb();
  const { householdId, lid } = await familie();
  const title = `E2E kaping ${Date.now() % 100000}`;
  const task = await createLooseTask(householdId, lid("Jurgen").id, title, todayAmsterdam(2));
  // Ellen heeft (bijv. via een direct verzoek) al een reeks met precies deze id aangemaakt
  const { error } = await db.from("task_recurrences").insert({
    id: task.id,
    household_id: householdId,
    title: "Reeks van Ellen",
    rule: { freq: "weekly", interval: 1, weekdays: [1] },
    starts_on: todayAmsterdam(2),
    created_by_member_id: lid("Ellen").id,
  });
  expect(error).toBeNull();

  await login(page, "jurgen@example.com");
  await page.goto("/taken");
  await page.getByPlaceholder("Zoek een taak").fill(title);
  await page.getByText(title).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Meer acties" }).click();
  await page.getByRole("menuitem", { name: /Bewerken/ }).click();
  const form = page.getByRole("dialog", { name: "Taak wijzigen" });
  await form.getByRole("switch").first().click(); // Herhalen
  await form.getByRole("button", { name: "Opslaan" }).click();

  await expectToast(page, /net door iemand anders aangepast/);
  const { data: after } = await db.from("tasks").select("recurrence_id, occurrence_date").eq("id", task.id).single();
  expect(after).toEqual({ recurrence_id: null, occurrence_date: null });
  const { data: series } = await db.from("task_recurrences").select("title, created_by_member_id").eq("id", task.id).single();
  expect(series).toEqual({ title: "Reeks van Ellen", created_by_member_id: lid("Ellen").id });
});

// =============================================================================
// Code-review N2 (D-032): bij "geen huishouden" (PGRST116) maximaal één keer herladen
// =============================================================================
test("N2: snapshot geeft PGRST116 terwijl de server de pagina blijft tonen → precies één herlaadactie", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await page.goto("/taken");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Vanaf nu ziet de browser het huishouden niet meer (zoals bij uitzetten),
  // maar de server-render blijft werken: zonder de vlag zou dit een lus geven
  await page.route("**/rest/v1/households*", (route) =>
    route.fulfill({
      status: 406,
      contentType: "application/json",
      body: JSON.stringify({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 0 rows", hint: null }),
    }),
  );
  let loads = 0;
  page.on("load", () => {
    loads += 1;
  });
  // Terugkomen in de app (online-signaal) laat de store verversen
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  await expect.poll(() => loads, { timeout: 10_000 }).toBe(1);
  await page.waitForTimeout(4_000); // na de herlaadactie ververst de store opnieuw en faalt weer
  expect(loads).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem("tl-reload-geen-huishouden"))).toBe("1");

  // Na een geslaagde verversing wordt de vlag weer gewist
  await page.unroute("**/rest/v1/households*");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("tl-reload-geen-huishouden")), { timeout: 10_000 }).toBeNull();
});

// =============================================================================
// Code-review N4 (D-032): backoff bij netwerkfouten terwijl de browser online is
// =============================================================================
test("N4: netwerkfouten terwijl online → de wachttijd tussen pogingen loopt op", async ({ page }) => {
  test.setTimeout(60_000);
  const { householdId, lid } = await familie();
  const title = `E2E backoff ${Date.now() % 100000}`;
  const task = await createLooseTask(householdId, lid("Jurgen").id, title, todayAmsterdam(0));
  await login(page, "jurgen@example.com");
  await page.goto("/");
  await expect(page.getByLabel(`${title} afvinken`).first()).toBeVisible();

  const attempts: number[] = [];
  await page.route("**/api/outbox", (route) => {
    attempts.push(Date.now());
    return route.abort("failed");
  });
  await page.getByLabel(`${title} afvinken`).first().click();
  await expectToast(page, "Opgeslagen op dit apparaat");

  await expect.poll(() => attempts.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(4);
  const gaps = attempts.slice(1, 4).map((t, i) => t - attempts[i]);
  // Verwacht ongeveer 2 s, 4 s, 8 s: elke wachttijd duidelijk langer dan de vorige
  expect(gaps[1]).toBeGreaterThan(gaps[0] * 1.5);
  expect(gaps[2]).toBeGreaterThan(gaps[1] * 1.5);
  // De wijziging blijft bewaard (niet weggegooid)
  await expect(page.getByText(/wijziging wacht/)).toBeVisible();
  const { count } = await adminDb().from("task_completions").select("id", { count: "exact", head: true }).eq("task_id", task.id);
  expect(count).toBe(0);
});
