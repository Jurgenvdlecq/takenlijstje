/**
 * WP2a — scope uit de code: integratie- en E2E-criteria (ACCEPTANCE_CRITERIA WP2).
 * AC-037, AC-041 (Int), AC-043, AC-044, AC-045, AC-062 (UI), AC-073.
 *
 * Draait tegen de lokale stack met E2E_RESEED=1 (demohuishouden "Familie").
 * Controles op de database gaan via de service role van de lokale stack.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { login } from "./helpers";
import { adminDb, completionCount, createLooseTask, familie, setActive, todayAmsterdam } from "./support/db";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const ORIGIN = new URL(BASE).origin;

function postOutbox(request: APIRequestContext, body: unknown) {
  return request.post("/api/outbox", {
    data: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: ORIGIN },
    maxRedirects: 0,
  });
}

/** Tweede ingelogde gebruiker in een eigen browsercontext */
async function alsGebruiker(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE, locale: "nl-NL", timezoneId: "Europe/Amsterdam", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await login(page, email);
  return page;
}

const complete = (taskId: string, mutationId = randomUUID()) => ({ v: 2, kind: "complete", payload: { taskId, mutationId } });

// =============================================================================
// AC-037 — twee mensen vinken tegelijk af
// =============================================================================
test("AC-037: Jurgen en Ellen vinken tegelijk af (verschillende mutationId's) → één registratie, beiden 'gedaan'", async ({ page, browser }) => {
  const { householdId, lid } = await familie();
  const task = await createLooseTask(householdId, lid("Jurgen").id, `E2E tegelijk ${Date.now()}`, todayAmsterdam(0));
  await login(page, "jurgen@example.com");
  const ellen = await alsGebruiker(browser, "ellen@example.com");
  try {
    const [a, b] = await Promise.all([postOutbox(page.request, complete(task.id)), postOutbox(ellen.request, complete(task.id))]);
    const [ra, rb] = [await a.json(), await b.json()];
    expect(ra).toMatchObject({ ok: true });
    expect(rb).toMatchObject({ ok: true });
    expect(ra.data.id).toBe(rb.data.id);
    expect(await completionCount(task.id)).toBe(1);
    const { data } = await adminDb().from("tasks").select("status").eq("id", task.id).single();
    expect(data?.status).toBe("done");
  } finally {
    await ellen.context().close();
  }
});

// =============================================================================
// AC-041 (Int) — een gezinslid draait de afvinking van een ander terug
// =============================================================================
test("AC-041: Lynn draait Ellens afvinking terug → taak open, historie weg", async ({ page, browser }) => {
  const { householdId, lid } = await familie();
  const task = await createLooseTask(householdId, lid("Ellen").id, `E2E terugdraaien ${Date.now()}`, todayAmsterdam(0));
  const ellen = await alsGebruiker(browser, "ellen@example.com");
  try {
    expect((await (await postOutbox(ellen.request, complete(task.id))).json()).ok).toBe(true);
  } finally {
    await ellen.context().close();
  }
  expect(await completionCount(task.id)).toBe(1);

  await login(page, "lynn@example.com");
  const res = await postOutbox(page.request, { v: 2, kind: "undo", payload: { taskId: task.id } });
  expect(await res.json()).toMatchObject({ ok: true });
  expect(await completionCount(task.id)).toBe(0);
  const { data } = await adminDb().from("tasks").select("status, completed_at").eq("id", task.id).single();
  expect(data).toEqual({ status: "todo", completed_at: null });
});

// =============================================================================
// AC-043 — afvinken tijdens bewerken
// =============================================================================
test("AC-043: Ellen bewerkt de titel terwijl Jurgen afvinkt → nieuwe titel opgeslagen, taak blijft gedaan", async ({ page, browser }) => {
  const { householdId, lid } = await familie();
  const title = `E2E bewerken ${Date.now() % 100000}`;
  const task = await createLooseTask(householdId, lid("Ellen").id, title, todayAmsterdam(2));

  await login(page, "ellen@example.com");
  await page.goto("/taken");
  await page.getByPlaceholder("Zoek een taak").fill(title);
  await page.getByText(title).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Meer acties" }).click();
  await page.getByRole("menuitem", { name: /Bewerken/ }).click();
  const form = page.getByRole("dialog", { name: "Taak wijzigen" });
  await expect(form.getByLabel("Naam taak")).toHaveValue(title);

  // Intussen vinkt Jurgen de taak af
  const jurgen = await alsGebruiker(browser, "jurgen@example.com");
  try {
    expect((await (await postOutbox(jurgen.request, complete(task.id))).json()).ok).toBe(true);
  } finally {
    await jurgen.context().close();
  }

  await form.getByLabel("Naam taak").fill(`${title} (nieuw)`);
  await form.getByRole("button", { name: "Opslaan" }).click();
  await expect.poll(async () => (await adminDb().from("tasks").select("title").eq("id", task.id).single()).data?.title, { timeout: 10_000 })
    .toBe(`${title} (nieuw)`);
  const { data } = await adminDb().from("tasks").select("status, completed_at").eq("id", task.id).single();
  expect(data?.status).toBe("done");
  expect(data?.completed_at).not.toBeNull();
  expect(await completionCount(task.id)).toBe(1);
});

// =============================================================================
// AC-044 — de volgende keer staat klaar na afvinken
// =============================================================================
test("AC-044: dagelijkse reeks met alleen vandaag open → na afvinken staat morgen klaar; tweede poging maakt niets extra", async ({ page }) => {
  const db = adminDb();
  const { householdId, lid } = await familie();
  const today = todayAmsterdam(0);
  const title = `E2E dagelijks ${Date.now() % 100000}`;
  const { data: series, error } = await db
    .from("task_recurrences")
    .insert({ household_id: householdId, title, rule: { freq: "daily", interval: 1 }, starts_on: today, generated_until: today, created_by_member_id: lid("Jurgen").id })
    .select("id")
    .single();
  expect(error).toBeNull();
  const { data: vandaag } = await db
    .from("tasks")
    .insert({ household_id: householdId, recurrence_id: series!.id, occurrence_date: today, scheduled_date: today, title, created_by_member_id: lid("Jurgen").id })
    .select("id")
    .single();

  await login(page, "lynn@example.com");
  expect((await (await postOutbox(page.request, complete(vandaag!.id))).json()).ok).toBe(true);

  const uitvoeringen = async () =>
    (await db.from("tasks").select("occurrence_date, status").eq("recurrence_id", series!.id).order("occurrence_date")).data ?? [];
  const na = await uitvoeringen();
  expect(na.find((t) => t.occurrence_date === todayAmsterdam(1))).toMatchObject({ status: "todo" });
  // Geen (reeks, datum) dubbel
  expect(new Set(na.map((t) => t.occurrence_date)).size).toBe(na.length);

  expect((await (await postOutbox(page.request, complete(vandaag!.id))).json()).ok).toBe(true);
  expect(await uitvoeringen()).toEqual(na);
  expect(await completionCount(vandaag!.id)).toBe(1);
});

// =============================================================================
// AC-045 — vervallen functies bestaan niet meer
// =============================================================================
const VERVALLEN = /\bWie\?|\bpunten\b|spaardoel|ruilen|ruilverzoek|overnemen|afwezig|\bnamens\b|toewijzen|toegewezen|om en om|verdel/i;

async function zichtbareTekst(page: Page) {
  return page.locator("body").innerText();
}

test.describe("AC-045: geen 'Wie?', punten, spaardoel, ruilen, afwezigheid of 'namens' in de interface", () => {
  for (const email of ["jurgen@example.com", "lynn@example.com"]) {
    test(`${email}: alle schermen`, async ({ page }) => {
      await login(page, email);
      for (const path of ["/", "/taken", "/kalender", "/boodschappen", "/meldingen", "/huishouden", "/instellingen"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        const tekst = await zichtbareTekst(page);
        expect(tekst.match(VERVALLEN)?.[0] ?? null, `${path} bevat een vervallen functie`).toBeNull();
      }
    });
  }

  test("nieuwe taak, taakdetail en bewerken", async ({ page }) => {
    await login(page, "jurgen@example.com");
    await page.getByRole("button", { name: "Nieuwe taak" }).click();
    const nieuw = page.getByRole("dialog");
    await expect(nieuw.getByLabel("Naam taak")).toBeVisible();
    await nieuw.getByRole("switch").first().click(); // Herhalen: vroeger verscheen hier de verdeling
    expect((await nieuw.innerText()).match(VERVALLEN)?.[0] ?? null).toBeNull();
    await page.keyboard.press("Escape");

    await page.goto("/taken");
    await page.getByPlaceholder("Zoek een taak").fill("WC schoonmaken");
    await page.getByText("WC schoonmaken").first().click();
    const detail = page.getByRole("dialog");
    await expect(detail).toContainText("WC schoonmaken");
    expect((await detail.innerText()).match(VERVALLEN)?.[0] ?? null).toBeNull();
    await detail.getByRole("button", { name: "Meer acties" }).click();
    expect((await page.getByRole("menu").innerText()).match(VERVALLEN)?.[0] ?? null).toBeNull();
    await page.getByRole("menuitem", { name: /Bewerken/ }).click();
    const form = page.getByRole("dialog", { name: "Taak wijzigen" });
    await expect(form.getByLabel("Naam taak")).toBeVisible();
    expect((await form.innerText()).match(VERVALLEN)?.[0] ?? null).toBeNull();
  });

  test("oude wachtrij-soort 'assign' wordt niet uitgevoerd, met de melding 'toewijzen'", async ({ page }) => {
    const { householdId, lid } = await familie();
    const task = await createLooseTask(householdId, lid("Jurgen").id, `E2E assign ${Date.now()}`, todayAmsterdam(3));
    await login(page, "jurgen@example.com");
    const res = await postOutbox(page.request, { v: 1, kind: "assign", payload: { taskId: task.id, memberId: lid("Lynn").id } });
    expect(await res.json()).toMatchObject({
      ok: false,
      code: "DISCARDED_OBSOLETE",
      error: "Een offline wijziging hoort bij een functie die niet meer bestaat (toewijzen) en is niet uitgevoerd.",
    });
    const { data } = await adminDb().from("tasks").select("*").eq("id", task.id).single();
    expect((data as Record<string, unknown>).assigned_member_id ?? null).toBeNull();
  });

  test("een v1-afvinking 'namens' Lynn registreert geen persoon", async ({ page }) => {
    const { householdId, lid } = await familie();
    const task = await createLooseTask(householdId, lid("Jurgen").id, `E2E namens ${Date.now()}`, todayAmsterdam(3));
    await login(page, "jurgen@example.com");
    const res = await postOutbox(page.request, { v: 1, kind: "complete", payload: { taskId: task.id, mutationId: randomUUID(), completedBy: lid("Lynn").id } });
    expect(await res.json()).toMatchObject({ ok: true });
    const { data: taak } = await adminDb().from("tasks").select("*").eq("id", task.id).single();
    const { data: hist } = await adminDb().from("task_completions").select("*").eq("task_id", task.id).single();
    expect((taak as Record<string, unknown>).completed_by_member_id ?? null).toBeNull();
    expect((hist as Record<string, unknown>).member_id ?? null).toBeNull();
    expect(JSON.stringify([taak, hist])).not.toContain(lid("Lynn").id);
  });
});

// =============================================================================
// AC-073 — "taak gedaan" naar iedereen die hem aan heeft, ook de afvinker
// =============================================================================
test.describe("AC-073: 'taak gedaan'", () => {
  test.afterEach(async () => {
    // Terug naar de seed: alleen Jurgen heeft "taak gedaan" aan; Kai actief
    const db = adminDb();
    const { lid } = await familie();
    await db.from("user_preferences").update({ notify_task_completed: false }).in("member_id", [lid("Ellen").id, lid("Lynn").id, lid("Kai").id]);
    await db.from("user_preferences").update({ notify_task_completed: true }).eq("member_id", lid("Jurgen").id);
    await setActive(lid("Kai").id, true);
  });

  test("Ellen en Jurgen (aan) krijgen elk één melding zonder naam; Lynn (uit) en Kai (uitgezet) niets — wie ook afvinkt", async ({ page, browser }) => {
    const db = adminDb();
    const { householdId, lid } = await familie();
    const [jurgen, ellen, lynn, kai] = ["Jurgen", "Ellen", "Lynn", "Kai"].map((n) => lid(n).id);
    await db.from("user_preferences").update({ notify_task_completed: true }).in("member_id", [jurgen, ellen, kai]);
    await db.from("user_preferences").update({ notify_task_completed: false }).eq("member_id", lynn);
    await setActive(kai, false);

    const stamp = Date.now() % 100000;
    const taakEllen = await createLooseTask(householdId, jurgen, `Vaatwasser uitruimen ${stamp}a`, todayAmsterdam(0));
    const taakJurgen = await createLooseTask(householdId, jurgen, `Vaatwasser uitruimen ${stamp}b`, todayAmsterdam(0));

    const meldingen = async (taskId: string) =>
      (await db.from("notifications").select("member_id, type, title, body").eq("task_id", taskId)).data ?? [];

    // Geval 1: Ellen vinkt af, en verstuurt dezelfde afvinking nog eens (dubbel)
    const ellenPage = await alsGebruiker(browser, "ellen@example.com");
    try {
      const entry = complete(taakEllen.id);
      expect((await (await postOutbox(ellenPage.request, entry)).json()).ok).toBe(true);
      expect((await (await postOutbox(ellenPage.request, entry)).json()).ok).toBe(true);

      // Ellen ziet de melding ook zelf in de app
      await ellenPage.goto("/meldingen");
      await expect(ellenPage.getByText(`${taakEllen.title} is gedaan`).first()).toBeVisible();
    } finally {
      await ellenPage.context().close();
    }

    // Geval 2: Jurgen vinkt af
    await login(page, "jurgen@example.com");
    expect((await (await postOutbox(page.request, complete(taakJurgen.id))).json()).ok).toBe(true);

    for (const taak of [taakEllen, taakJurgen]) {
      await expect.poll(async () => (await meldingen(taak.id)).length, { timeout: 10_000 }).toBe(2);
      const rows = await meldingen(taak.id);
      // Precies één per ontvanger, en alleen Jurgen en Ellen
      expect(rows.map((r) => r.member_id).sort()).toEqual([jurgen, ellen].sort());
      for (const r of rows) {
        expect(r.type).toBe("task_completed");
        expect(r.title).toBe(`${taak.title} is gedaan`);
        expect(`${r.title} ${r.body ?? ""}`).not.toMatch(/Jurgen|Ellen|Lynn|Kai|door|voor jou|van jou/);
      }
    }
    // Lynn en Kai niets
    const { count } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .in("task_id", [taakEllen.id, taakJurgen.id])
      .in("member_id", [lynn, kai]);
    expect(count).toBe(0);
  });
});

// =============================================================================
// AC-062 (UI) — de schrijver van een notitie blijft zichtbaar na vertrek
// =============================================================================
test("AC-062: notitie van een lid dat uit het huishouden is verwijderd toont nog de naam van de schrijver", async ({ page }) => {
  const db = adminDb();
  const { householdId, lid } = await familie();
  const stamp = Date.now() % 100000;
  const naam = `Logé${stamp}`;
  const { data: user } = await db.auth.admin.createUser({ email: `loge-${stamp}@example.com`, password: "Welkom123!", email_confirm: true });
  try {
    const { data: member, error } = await db
      .from("household_members")
      .insert({ household_id: householdId, user_id: user.user!.id, display_name: naam, role: "member", color: "#16a34a" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const title = `E2E notitie ${stamp}`;
    const task = await createLooseTask(householdId, lid("Jurgen").id, title, todayAmsterdam(1));
    const body = `Ladder staat in de schuur ${stamp}`;
    expect((await db.from("task_comments").insert({ household_id: householdId, task_id: task.id, member_id: member!.id, body })).error).toBeNull();

    // Het lid wordt uit het huishouden verwijderd
    expect((await db.from("household_members").delete().eq("id", member!.id)).error).toBeNull();
    const { data: notitie } = await db.from("task_comments").select("*").eq("task_id", task.id).single();
    expect(notitie).toMatchObject({ member_id: null, author_name: naam, body });

    await login(page, "jurgen@example.com");
    await page.goto("/taken");
    await page.getByPlaceholder("Zoek een taak").fill(title);
    await page.getByText(title).first().click();
    const detail = page.getByRole("dialog");
    const item = detail.getByRole("listitem").filter({ hasText: body });
    await expect(item).toBeVisible();
    await expect(item).toContainText(naam);
    await expect(item).not.toContainText("Onbekend");
  } finally {
    if (user.user) await db.auth.admin.deleteUser(user.user.id);
  }
});
