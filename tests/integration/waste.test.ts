/**
 * W-03 afvalkalender — systeemlaag tegen de lokale teststack (TECHNICAL_DESIGN
 * §18.15, kolom Int; AC-183, AC-194, AC-197, AC-204, AC-205, AC-211, AC-212,
 * AC-213, AC-214). De gemeentebron is altijd nagebootst: een geïnjecteerde fetch
 * met SYNTHETISCHE antwoorden; er gaat niets naar buiten.
 */
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const push = vi.hoisted(() => ({ sends: [] as { endpoint: string; payload: string }[] }));
vi.mock("web-push", () => {
  const api = {
    setVapidDetails: () => undefined,
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      push.sends.push({ endpoint: sub.endpoint, payload });
      return { statusCode: 201 };
    },
  };
  return { default: api, ...api };
});

import { addDays, zonedInstant } from "@/domain/dates";
import { emptyPickups, type WastePickups } from "@/domain/waste/plan";
import { confirmWasteCalendar, retryWasteSync, runWasteStep } from "@/server/system/waste/sync";
import { runTick } from "@/server/system/tick";
import type { FoundCalendar } from "@/server/waste/lookup";
import { WASTE_SOURCE_BASE_URL, type SourceDeps } from "@/server/waste/source";
import { maakGezin, meldingenVan, must, ruimOp, testDb, TZ, vandaag } from "./support/fixtures";

const NOW = new Date();
const TODAY = vandaag(NOW);
const BAG = "0518200000999001";
const ADRES = { postcode: "2591BB", houseNumber: 87, suffix: "" };

function found(pickups: Partial<WastePickups>): FoundCalendar {
  const p = { ...emptyPickups(), ...pickups };
  return { kind: "found", address: ADRES, bagId: BAG, display: "Teststraat 87, Den Haag", pickups: p, next: { rest: p.rest[0] ?? null, papier: p.papier[0] ?? null, pmd: p.pmd[0] ?? null } };
}

/** Nagebootste bron (endpoint B + C); telt verzoeken en bewaart de URL's */
function bron(dates: { rest?: string[]; papier?: string[]; pmd?: string[] } | "storing" | "leeg") {
  const urls: string[] = [];
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    if (dates === "storing") return new Response("", { status: 503 });
    if (url.endsWith("/afvalstromen")) {
      return Response.json([
        { id: 1, title: "Restafval", icon: "zak-grijs-rest" },
        { id: 2, title: "Papier", icon: "doos-karton-papier" },
        { id: 3, title: "PMD", icon: "petfles-blik-drankpak_pmd" },
      ]);
    }
    const lijst = dates === "leeg" ? {} : dates;
    const rows = Object.entries({ 1: lijst.rest ?? [], 2: lijst.papier ?? [], 3: lijst.pmd ?? [] }).flatMap(([id, ds]) =>
      ds.map((d) => ({ afvalstroom_id: Number(id), ophaaldatum: d })),
    );
    return Response.json(rows);
  });
  const deps: SourceDeps = { fetch: fetch as unknown as typeof globalThis.fetch, signal: new AbortController().signal, baseUrl: WASTE_SOURCE_BASE_URL };
  return { deps, fetch, urls };
}

async function afvaltaken(householdId: string) {
  return must(
    await testDb()
      .from("tasks")
      .select("id, title, status, scheduled_date, scheduled_time, due_at, available_from, waste_pickup_date, waste_direction, waste_streams, created_by_member_id")
      .eq("household_id", householdId)
      .not("waste_direction", "is", null)
      .order("waste_pickup_date"),
    "afvaltaken",
  );
}

async function kalender(householdId: string) {
  return (await testDb().from("waste_calendars").select("*").eq("household_id", householdId).maybeSingle()).data;
}

/** Tick-stap alleen voor dit huishouden laten ophalen: zet de andere kalenders op "net geprobeerd" */
async function maakOphaalbaar(householdId: string, at: Date) {
  must(
    await testDb().from("waste_calendars").update({ last_attempt_at: null, last_success_at: addDays(TODAY, -1) + "T04:00:00Z" }).eq("household_id", householdId).select("household_id"),
    "ophaalbaar",
  );
  must(
    await testDb().from("waste_calendars").update({ last_attempt_at: at.toISOString() }).neq("household_id", householdId).select("household_id"),
    "anderen niet",
  );
}

afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await ruimOp();
});

describe("opslaan en vervangen (AC-183, AC-214, AC-215, AC-219)", () => {
  it("nieuw adres: taken voor vandaag t/m +14, zonder maker; ander adres vervangt alleen open taken", async () => {
    const gezin = await maakGezin("AfvalOpslaan", [{ naam: "Jurgen", rol: "admin" }]);
    const { memberId } = gezin.leden.Jurgen;
    await confirmWasteCalendar(gezin.householdId, memberId, found({ rest: [addDays(TODAY, 3), addDays(TODAY, 14), addDays(TODAY, 15)] }), NOW);
    let taken = await afvaltaken(gezin.householdId);
    expect(taken.map((t) => `${t.waste_pickup_date}|${t.waste_direction}`)).toEqual([
      `${addDays(TODAY, 3)}|out`,
      `${addDays(TODAY, 3)}|in`,
      `${addDays(TODAY, 14)}|out`,
      `${addDays(TODAY, 14)}|in`,
    ]);
    expect(taken.every((t) => t.created_by_member_id === null)).toBe(true);
    const out = taken.find((t) => t.waste_direction === "out")!;
    expect(out).toMatchObject({ title: "Restafval buitenzetten", scheduled_date: addDays(TODAY, 2), due_at: expect.any(String) });
    expect(new Date(out.due_at!).toISOString()).toBe(zonedInstant(addDays(TODAY, 3), "07:45", TZ));

    // Eén taak afvinken, dan verhuizen: open taken weg, de afgevinkte blijft
    must(await testDb().from("tasks").update({ status: "done", completed_at: NOW.toISOString() }).eq("id", out.id).select("id"), "afvinken");
    await confirmWasteCalendar(gezin.householdId, memberId, { ...found({ pmd: [addDays(TODAY, 5)] }), address: { ...ADRES, houseNumber: 89 }, bagId: "0518200000999002" }, NOW);
    taken = await afvaltaken(gezin.householdId);
    expect(taken.filter((t) => t.status === "done").map((t) => t.id)).toEqual([out.id]);
    expect(taken.filter((t) => t.status === "todo").every((t) => t.waste_streams?.join() === "pmd")).toBe(true);
    expect((await kalender(gezin.householdId))?.house_number).toBe(89);
  });
});

describe("tickstap (AC-197, AC-204, AC-205, AC-212)", () => {
  it("twee keer na elkaar en twee keer tegelijk: één keer ophalen, geen extra taken", async () => {
    const gezin = await maakGezin("AfvalTick", [{ naam: "Jurgen", rol: "admin" }]);
    await confirmWasteCalendar(gezin.householdId, gezin.leden.Jurgen.memberId, found({ rest: [addDays(TODAY, 3)] }), NOW);
    await maakOphaalbaar(gezin.householdId, NOW);
    const b = bron({ rest: [addDays(TODAY, 3), addDays(TODAY, 6)] });
    await Promise.all([runWasteStep(testDb(), NOW, Date.now(), b.deps), runWasteStep(testDb(), NOW, Date.now(), b.deps)]);
    await runWasteStep(testDb(), NOW, Date.now(), b.deps);
    // B + C = 2 verzoeken voor één ophaalronde (C(J+1) alleen in december)
    expect(b.fetch.mock.calls.length).toBe(new Date(TODAY).getUTCMonth() === 11 ? 3 : 2);
    expect(b.urls.every((u) => u.startsWith(`${WASTE_SOURCE_BASE_URL}/rest/adressen/${BAG}/`))).toBe(true);
    const taken = await afvaltaken(gezin.householdId);
    expect(taken.length).toBe(4);
    expect(new Set(taken.map((t) => `${t.waste_pickup_date}|${t.waste_direction}`)).size).toBe(4);
  });

  it("storing: taken, adres en datums blijven; teller loopt op; log zonder adres", async () => {
    const gezin = await maakGezin("AfvalStoring", [{ naam: "Jurgen", rol: "admin" }]);
    await confirmWasteCalendar(gezin.householdId, gezin.leden.Jurgen.memberId, found({ rest: [addDays(TODAY, 3)] }), NOW);
    const voor = await afvaltaken(gezin.householdId);
    await maakOphaalbaar(gezin.householdId, NOW);
    const logs: string[] = [];
    for (const level of ["info", "warn", "error", "log"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(" ")));
    }
    await runWasteStep(testDb(), NOW, Date.now(), bron("storing").deps);
    expect(await afvaltaken(gezin.householdId)).toEqual(voor);
    const cal = await kalender(gezin.householdId);
    expect(cal).toMatchObject({ last_error_code: "UNREACHABLE", failure_count: 1, postcode: "2591BB" });
    const alles = logs.join("\n");
    for (const verboden of ["2591", BAG, "Teststraat", gezin.householdId]) expect(alles).not.toContain(verboden);
  });

  it("langer dan 48 uur: één melding aan elke actieve beheerder, niet aan het gezinslid; geen tweede", async () => {
    const gezin = await maakGezin("AfvalAlarm", [
      { naam: "Jurgen", rol: "admin" },
      { naam: "Ellen", rol: "admin", prefs: { notify_reminders: false } },
      { naam: "Lynn", rol: "member" },
    ]);
    await confirmWasteCalendar(gezin.householdId, gezin.leden.Jurgen.memberId, found({ rest: [addDays(TODAY, 3)] }), NOW);
    must(
      await testDb()
        .from("waste_calendars")
        .update({ last_success_at: new Date(NOW.getTime() - 50 * 3600_000).toISOString(), last_attempt_at: NOW.toISOString(), last_error_code: "UNREACHABLE", failure_count: 5 })
        .eq("household_id", gezin.householdId)
        .select("household_id"),
      "storing",
    );
    await runWasteStep(testDb(), NOW, Date.now(), bron("storing").deps);
    await runWasteStep(testDb(), NOW, Date.now(), bron("storing").deps);
    const meldingen = (await meldingenVan(gezin.householdId)).filter((m) => m.type === "waste_sync_failed");
    expect(meldingen.map((m) => m.member_id).sort()).toEqual([gezin.leden.Ellen.memberId, gezin.leden.Jurgen.memberId].sort());
    for (const m of meldingen) expect(`${m.title} ${m.body}`).not.toMatch(/2591|Teststraat|87/);
  });

  it("'Opnieuw proberen' hooguit één keer per minuut", async () => {
    const gezin = await maakGezin("AfvalRetry", [{ naam: "Jurgen", rol: "admin" }]);
    await confirmWasteCalendar(gezin.householdId, gezin.leden.Jurgen.memberId, found({ rest: [addDays(TODAY, 3)] }), NOW);
    const b = bron({ rest: [addDays(TODAY, 3)] });
    const later = new Date(NOW.getTime() + 2 * 60_000);
    expect((await retryWasteSync(gezin.householdId, later, b.deps)).kind).toBe("done");
    expect((await retryWasteSync(gezin.householdId, new Date(later.getTime() + 20_000), b.deps)).kind).toBe("too_soon");
  });
});

describe("herinneringen via de tick (AC-194, AC-211)", () => {
  it("21:00 één herinnering per ontvanger met herinneringen aan; tweede tick niets; geen deadline of verlopen", async () => {
    const gezin = await maakGezin("AfvalHerinner", [
      { naam: "Jurgen", rol: "admin", prefs: { notify_reminders: true } },
      { naam: "Lynn", rol: "member", prefs: { notify_reminders: false } },
      { naam: "Kai", rol: "member", actief: false, prefs: { notify_reminders: true } },
    ]);
    const d = addDays(TODAY, 1);
    await confirmWasteCalendar(gezin.householdId, gezin.leden.Jurgen.memberId, found({ rest: [d] }), NOW);
    // Niet ophalen in deze tick
    must(await testDb().from("waste_calendars").update({ last_attempt_at: NOW.toISOString(), last_success_at: NOW.toISOString() }).neq("household_id", "00000000-0000-0000-0000-000000000000").select("household_id"), "geen ophalen");
    const anker = new Date(zonedInstant(TODAY, "21:05", TZ));
    await runTick(anker);
    await runTick(anker);
    const afval = (await meldingenVan(gezin.householdId)).filter((m) => m.dedupe_key?.startsWith("waste:"));
    expect(afval.map((m) => m.member_id)).toEqual([gezin.leden.Jurgen.memberId]);
    expect(afval[0]).toMatchObject({ type: "reminder", title: "Herinnering: Restafval buitenzetten", body: "Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45." });
    const ander = (await meldingenVan(gezin.householdId)).filter((m) => ["deadline_soon", "overdue"].includes(m.type));
    expect(ander).toEqual([]);
  });
});

describe("uitzetten (AC-213)", () => {
  it("daarna maakt de tick geen afvaltaken en vraagt niets op", async () => {
    const gezin = await maakGezin("AfvalUit", [{ naam: "Jurgen", rol: "admin" }]);
    await confirmWasteCalendar(gezin.householdId, gezin.leden.Jurgen.memberId, found({ rest: [addDays(TODAY, 3)] }), NOW);
    must(await testDb().from("tasks").delete().eq("household_id", gezin.householdId).not("waste_direction", "is", null).in("status", ["todo", "in_progress"]).select("id"), "open weg");
    must(await testDb().from("waste_calendars").delete().eq("household_id", gezin.householdId).select("household_id"), "adres weg");
    const b = bron({ rest: [addDays(TODAY, 3)] });
    await runWasteStep(testDb(), NOW, Date.now(), b.deps);
    expect(await afvaltaken(gezin.householdId)).toEqual([]);
    expect(b.urls.some((u) => u.includes(BAG))).toBe(false);
  });
});
