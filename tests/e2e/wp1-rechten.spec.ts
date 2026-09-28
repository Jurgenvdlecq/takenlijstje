/**
 * WP1 — rechtenmodel en securityfixes: de criteria die niet in de database
 * zelf te toetsen zijn (Int/E2E). Zie docs/ACCEPTANCE_CRITERIA.md.
 *
 * Draait tegen de lokale stack met E2E_RESEED=1 (demohuishouden "Familie").
 * Controles op de database gaan via de service role van de lokale stack.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { expectToast, login } from "./helpers";
import { adminDb, completionCount, createLooseTask, familie, readAppIdb, setActive, todayAmsterdam, writeOutboxIdb } from "./support/db";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const ORIGIN = new URL(BASE).origin;

function postOutbox(request: APIRequestContext, body: unknown, headers: Record<string, string> = {}) {
  return request.post("/api/outbox", {
    data: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    maxRedirects: 0,
  });
}

// =============================================================================
// POST /api/outbox: CSRF, sessie en idempotentie (TECHNICAL_DESIGN §9.3.1)
// =============================================================================
test.describe("POST /api/outbox zonder sessie", () => {
  test("weigert text/plain met 415", async ({ request }) => {
    const res = await request.post("/api/outbox", {
      data: JSON.stringify({ v: 1, kind: "complete", payload: {} }),
      headers: { "content-type": "text/plain", origin: ORIGIN },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(415);
  });

  test("weigert een verzoek zonder Origin met 403", async ({ request }) => {
    const res = await request.post("/api/outbox", {
      data: JSON.stringify({ v: 1, kind: "complete", payload: {} }),
      headers: { "content-type": "application/json" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  test("weigert een vreemde Origin met 403", async ({ request }) => {
    const res = await postOutbox(request, { v: 1, kind: "complete", payload: {} }, { origin: "https://evil.example" });
    expect(res.status()).toBe(403);
  });

  test("zonder sessie: 401 in JSON, geen redirect naar /login", async ({ request }) => {
    const res = await postOutbox(request, { v: 1, kind: "complete", payload: { taskId: randomUUID(), mutationId: randomUUID() } });
    expect(res.status()).toBe(401);
    expect(res.headers()["content-type"]).toContain("application/json");
    expect(res.headers()["location"]).toBeUndefined();
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
  });
});

test.describe("POST /api/outbox als Jurgen", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "jurgen@example.com");
  });

  test("dubbele complete-entry (zelfde mutationId) → precies één registratie", async ({ page }) => {
    const { householdId, lid } = await familie();
    const task = await createLooseTask(householdId, lid("Jurgen").id, `E2E dubbel ${Date.now()}`, todayAmsterdam(5));
    const entry = { v: 1, kind: "complete", payload: { taskId: task.id, mutationId: randomUUID() } };

    const [a, b] = await Promise.all([postOutbox(page.request, entry), postOutbox(page.request, entry)]);
    const c = await postOutbox(page.request, entry);
    for (const res of [a, b, c]) {
      expect(res.status()).toBe(200);
      expect((await res.json()).ok).toBe(true);
    }
    expect(await completionCount(task.id)).toBe(1);
  });

  test("AC-172: v0-afvinking (zonder versie, met completedBy) wordt omgezet → één registratie, ook bij opnieuw versturen", async ({ page }) => {
    const { householdId, lid } = await familie();
    const task = await createLooseTask(householdId, lid("Jurgen").id, `E2E v0 api ${Date.now()}`, todayAmsterdam(5));
    const v0 = { kind: "complete", payload: { taskId: task.id, mutationId: randomUUID(), completedBy: lid("Jurgen").id } };
    expect((await (await postOutbox(page.request, v0)).json()).ok).toBe(true);
    expect((await (await postOutbox(page.request, v0)).json()).ok).toBe(true);
    expect(await completionCount(task.id)).toBe(1);
  });

  test("AC-172: soort die niet meer bestaat → niet uitgevoerd, met melding", async ({ page }) => {
    const res = await postOutbox(page.request, { kind: "swapRequest", payload: { taskId: randomUUID() } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: "DISCARDED_OBSOLETE" });
    expect(body.error).toContain("hoort bij een functie die niet meer bestaat");
  });

  test("'__proto__' als soort wordt niet uitgevoerd", async ({ page }) => {
    const res = await postOutbox(page.request, { v: 1, kind: "__proto__", payload: { taskId: randomUUID() } });
    expect(res.status()).toBe(200);
    expect((await res.json()).code).toBe("DISCARDED_OBSOLETE");
  });

  test("nieuwere versie dan de server kent → 503 UNSUPPORTED_VERSION (blijft in de wachtrij)", async ({ page }) => {
    const { householdId, lid } = await familie();
    const task = await createLooseTask(householdId, lid("Jurgen").id, `E2E toekomst ${Date.now()}`, todayAmsterdam(5));
    const res = await postOutbox(page.request, { v: 99, kind: "complete", payload: { taskId: task.id, mutationId: randomUUID() } });
    expect(res.status()).toBe(503);
    expect((await res.json()).code).toBe("UNSUPPORTED_VERSION");
    expect(await completionCount(task.id)).toBe(0);
  });

  test("AC-172: v0-entry in IndexedDB wordt na opnieuw openen precies één keer verwerkt", async ({ page }) => {
    const { householdId, lid } = await familie();
    const task = await createLooseTask(householdId, lid("Jurgen").id, `E2E v0 idb ${Date.now()}`, todayAmsterdam(5));
    const mutationId = randomUUID();
    const v0Entry = (id: string) => ({
      id,
      kind: "complete",
      payload: { taskId: task.id, mutationId, completedBy: lid("Jurgen").id },
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Jurgen");
    // Twee keer dezelfde afvinking in de wachtrij (bijv. na een dubbele poging van de oude app)
    await writeOutboxIdb(page, [v0Entry(randomUUID()), v0Entry(randomUUID())]);
    await page.reload();
    await expect.poll(() => completionCount(task.id), { timeout: 15_000 }).toBe(1);
    await expect.poll(async () => (await readAppIdb(page)).outbox.length, { timeout: 15_000 }).toBe(0);
    expect(await completionCount(task.id)).toBe(1);
  });
});

// =============================================================================
// AC-004 / AC-009: "deze en toekomstige" wijzigen door een gezinslid dat niet de maker is
// =============================================================================
async function reeksStand(recurrenceId: string) {
  const db = adminDb();
  const { data: series } = await db.from("task_recurrences").select("title, rule, updated_at, generated_until, is_active").eq("id", recurrenceId).single();
  const { data: tasks } = await db
    .from("tasks")
    .select("id, title, status, scheduled_date, deleted_at, updated_at")
    .eq("recurrence_id", recurrenceId)
    .order("id");
  return JSON.stringify({ series, tasks });
}

test("AC-004/AC-009: Lynn wijzigt 'deze en toekomstige' van Jurgens reeks → geweigerd en er is niets veranderd", async ({ page }) => {
  const db = adminDb();
  const { householdId, lid } = await familie();
  const { data: series } = await db
    .from("task_recurrences")
    .select("id, title")
    .eq("household_id", householdId)
    .eq("title", "Dweilen")
    .eq("created_by_member_id", lid("Jurgen").id)
    .single();
  expect(series, "reeks Dweilen van Jurgen in de seed").toBeTruthy();
  const voor = await reeksStand(series!.id);

  await login(page, "lynn@example.com");
  await page.goto("/taken");
  await page.getByPlaceholder("Zoek een taak").fill("Dweilen");
  await page.getByText("Dweilen").first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Meer acties" }).click();
  await page.getByRole("menuitem", { name: /Bewerken/ }).click();
  const form = page.getByRole("dialog", { name: "Taak wijzigen" });
  await form.getByLabel("Naam taak").fill("Dweilen (gehackt)");
  await form.getByRole("button", { name: "Opslaan" }).click();
  await page.getByRole("button", { name: "Deze en toekomstige taken" }).click();

  await expectToast(page, /Alleen een beheerder of wie de reeks maakte/);
  // Er is niets veranderd: reeks en alle uitvoeringen gelijk aan ervoor
  await page.waitForTimeout(500);
  expect(await reeksStand(series!.id)).toBe(voor);
});

// =============================================================================
// AC-022/AC-023/AC-032: uitgezet lid
// =============================================================================
test.describe("uitgezet lid (V-29)", () => {
  test.afterEach(async () => {
    const { lid } = await familie();
    await setActive(lid("Lynn").id, true);
  });

  test("AC-023: Lynn wordt uitgezet → alleen /geen-toegang, lokale cache en wachtrij leeg", async ({ page }) => {
    const { lid } = await familie();
    await login(page, "lynn@example.com");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lynn");
    // De app bewaart de laatste stand voor offline gebruik
    await expect.poll(async () => (await readAppIdb(page)).cache, { timeout: 10_000 }).toBeGreaterThan(0);

    await setActive(lid("Lynn").id, false);
    await page.goto("/");
    await expect(page).toHaveURL(/\/geen-toegang$/);
    await expect(page.getByRole("heading", { name: "Geen toegang" })).toBeVisible();
    await expect(page.getByText(/‘Familie’/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Uitloggen" })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByText("Dweilen")).toHaveCount(0);
    await expect.poll(async () => (await readAppIdb(page)).cache, { timeout: 10_000 }).toBe(0);
    expect((await readAppIdb(page)).outbox).toEqual([]);

    // Ook andere pagina's sturen door naar /geen-toegang
    await page.goto("/taken");
    await expect(page).toHaveURL(/\/geen-toegang$/);
  });

  test("AC-022/AC-032: afvinking van een uitgezet lid → FORBIDDEN, er wordt niets geregistreerd", async ({ page }) => {
    const { householdId, lid } = await familie();
    const task = await createLooseTask(householdId, lid("Jurgen").id, `E2E uitgezet ${Date.now()}`, todayAmsterdam(5));
    await login(page, "lynn@example.com");
    await setActive(lid("Lynn").id, false);
    const res = await postOutbox(page.request, { v: 1, kind: "complete", payload: { taskId: task.id, mutationId: randomUUID() } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await completionCount(task.id)).toBe(0);
  });
});

test("AC-032: geweigerde offline afvinking → melding met de taaknaam, niet eindeloos herhaald", async ({ page, context }) => {
  const { householdId, lid } = await familie();
  const title = `E2E verdwijnt ${Date.now() % 100000}`;
  const task = await createLooseTask(householdId, lid("Jurgen").id, title, todayAmsterdam(0));
  await login(page, "jurgen@example.com");
  await page.goto("/");
  await expect(page.getByLabel(`${title} afvinken`).first()).toBeVisible();

  await context.setOffline(true);
  await page.getByLabel(`${title} afvinken`).first().click();
  await expectToast(page, "Opgeslagen op dit apparaat");
  // Intussen verwijdert een beheerder de taak (zacht, zoals delete_task)
  await adminDb().from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", task.id);
  await context.setOffline(false);

  await expectToast(page, new RegExp(`1 offline wijziging kon niet worden verwerkt: ${title}`));
  await expect.poll(async () => (await readAppIdb(page)).outbox.length, { timeout: 15_000 }).toBe(0);
  await expect(page.getByText(/wijziging wacht/)).toHaveCount(0);
  expect(await completionCount(task.id)).toBe(0);
});

// =============================================================================
// AC-031: uitloggen wist alles lokaal
// =============================================================================
async function pageCaches(page: Page): Promise<string[]> {
  return page.evaluate(async () => ("caches" in self ? await caches.keys() : []));
}

test("AC-031: uitloggen wist de IndexedDB-cache, de wachtrij en de paginacache", async ({ page }) => {
  await login(page, "jurgen@example.com");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Jurgen");
  await expect.poll(async () => (await readAppIdb(page)).cache, { timeout: 10_000 }).toBeGreaterThan(0);

  await page.goto("/instellingen");
  await page.getByRole("button", { name: "Uitloggen" }).click();
  await page.waitForURL(/\/login/);
  const idb = await readAppIdb(page);
  expect(idb.cache).toBe(0);
  expect(idb.outbox).toEqual([]);
  expect(await pageCaches(page)).not.toContain("pages-v2");

  // Ellen logt daarna in op hetzelfde toestel en krijgt haar eigen sessie
  await login(page, "ellen@example.com");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ellen");
});

// =============================================================================
// AC-029 (B-05): tick en status alleen met het geheim
// =============================================================================
test.describe("AC-029: /api/status en /api/cron/tick", () => {
  for (const path of ["/api/status", "/api/cron/tick"]) {
    test(`${path} zonder Bearer → 401`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(401);
      expect(JSON.stringify(await res.json())).not.toMatch(/eyJ|secret|key/i);
    });

    test(`${path} met een verkeerde Bearer → 401`, async ({ request }) => {
      const res = await request.get(path, { headers: { authorization: "Bearer fout-geheim" }, maxRedirects: 0 });
      expect(res.status()).toBe(401);
    });
  }

  test("/api/status met het juiste geheim → alleen status, geen geheimen", async ({ request }) => {
    const secret = process.env.E2E_CRON_SECRET;
    test.skip(!secret, "E2E_CRON_SECRET niet meegegeven (het geheim van de draaiende app)");
    const res = await request.get("/api/status", { headers: { authorization: `Bearer ${secret}` } });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(secret!);
    expect(text).not.toMatch(/eyJ[\w-]+\.[\w-]+/);
  });
});
