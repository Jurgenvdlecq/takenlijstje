/**
 * WP3b — afvalkalender (W-03) tegen de LOKALE teststack (TECHNICAL_DESIGN §18.15,
 * kolom "Int"; ACCEPTANCE_CRITERIA AC-183…AC-223, AC-236, AC-237; D-047…D-049).
 *
 * - De gemeentebron wordt altijd nagebootst: de globale `fetch` stuurt alleen
 *   verzoeken naar de vaste host naar de testbron (`src/server/waste/__tests__/bron.ts`);
 *   alles wat naar de lokale stack gaat, blijft echt. Zo tellen we ook de verzoeken
 *   die de server actions doen (die hebben geen `deps.fetch`).
 * - Server actions draaien met een nagebootste sessie (`@/server/context`): een
 *   gebruikersclient met een JWT voor de lokale stack, zodat RLS en de guards
 *   echt gelden. Wie "ingelogd" is, staat per aanroep in een AsyncLocalStorage,
 *   zodat twee beheerders tegelijk kunnen bevestigen (AC-191).
 * - Tijd: de tick en de systeemfuncties krijgen een vaste `now` in 2026; de
 *   actions gebruiken de echte klok, dus hun testdata ligt relatief aan vandaag.
 * - web-push is gemockt; de payloads worden bewaard voor AC-212.
 * - Elk scenario maakt een eigen huishouden en ruimt het na afloop op.
 */
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => Promise.resolve().then(fn) }));

const push = vi.hoisted(() => ({ payloads: [] as string[] }));
vi.mock("web-push", () => {
  const api = {
    setVapidDetails: () => undefined,
    sendNotification: async (_sub: unknown, payload: string) => {
      push.payloads.push(payload);
      return { statusCode: 201 };
    },
  };
  return { default: api, ...api };
});

// Nagebootste sessie: wie is ingelogd, per asynchrone aanroep
const sessie = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  return { store: new AsyncLocalStorage<string>() };
});
vi.mock("@/server/context", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { signJwt } = await import("../e2e/support/rest-gateway.mjs");
  const { UserError } = await import("@/server/errors");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const requireMember = async () => {
    const userId = sessie.store.getStore();
    if (!userId) throw new UserError("Je bent niet (meer) ingelogd. Log opnieuw in.", "UNAUTHENTICATED");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = signJwt({ sub: userId, role: "authenticated", aud: "authenticated", iss: "supabase", exp });
    const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: members } = await supabase.from("household_members").select("*").eq("user_id", userId).order("created_at").limit(1);
    const member = members?.[0];
    if (!member) throw new UserError("Je bent geen lid van een huishouden.", "FORBIDDEN");
    if (!member.is_active) throw new UserError("Je hebt op dit moment geen toegang tot dit huishouden.", "FORBIDDEN");
    const { data: households } = await supabase.from("households").select("*").eq("id", member.household_id);
    const household = households?.[0];
    if (!household) throw new UserError("Je hebt op dit moment geen toegang tot dit huishouden.", "FORBIDDEN");
    return { supabase, user: { id: userId }, household, member, isAdmin: member.role === "admin" };
  };
  const requireAdmin = async () => {
    const ctx = await requireMember();
    if (!ctx.isAdmin) throw new UserError("Alleen een beheerder kan dit doen.", "FORBIDDEN");
    return ctx;
  };
  return { requireMember, requireAdmin, getHouseholdContext: async () => null };
});

import { zonedInstant } from "@/domain/dates";
import { WASTE_TEXT } from "@/domain/waste/messages";
import { appUrl } from "@/lib/app-url";
import { addCommentAction, completeTaskAction, deleteTaskAction, moveTaskAction, setTaskStatusAction, undoCompleteAction, updateTaskAction } from "@/server/actions/tasks";
import {
  confirmWasteAddressAction,
  disableWasteCalendarAction,
  getWasteSettingsAction,
  lookupWasteAddressAction,
  retryWasteSyncAction,
  type WasteAddressInput,
} from "@/server/actions/waste";
import { requireAdmin } from "@/server/context";
import { getWasteSettings } from "@/server/services/waste-read";
import { runTick } from "@/server/system/tick";
import { allowWasteLookup, applyConfirmedSameAddress, runWasteStep, saveWasteCalendar, syncHousehold, WASTE_LOOKUP_LIMIT_PER_HOUR } from "@/server/system/waste/sync";
import { BRON_HOST, laadFixture, maakBron, rijen, type Bron, type BronOpties, type Fixture } from "@/server/waste/__tests__/bron";
import { lookupWasteCalendar } from "@/server/waste/lookup";
import type { WasteCalendarRow } from "@/types/database";
import { maakGezin, meldingenVan, must, ruimOp, testDb, vandaag, TZ, type Gezin } from "./support/fixtures";

// ---------------------------------------------------------------------------
// Testbron achter de globale fetch
// ---------------------------------------------------------------------------
const echteFetch = globalThis.fetch;
let bron: Bron | null = null;
vi.stubGlobal("fetch", ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith(`${BRON_HOST}/`)) {
    if (!bron) throw new Error("Test: verzoek naar de gemeentebron zonder testbron");
    return bron.fetch(input, init);
  }
  return echteFetch(input, init);
}) as typeof fetch);

const BASIS = laadFixture("synthetisch-rest-papier-pmd");
const BAG = "0518200000000101";
const ADRES: WasteAddressInput = { postcode: "2511 ab", houseNumber: "12", suffix: null };
const NOW = new Date();
const d = (n: number) => vandaag(NOW, n);
/** ISO-instant van een dag + tijd in Amsterdam */
const om = (dag: string, tijd: string) => new Date(zonedInstant(dag, tijd, TZ));

/** Testbron met eigen ophaaldagen (per bak), in de vorm van de gemeente; per jaar gesplitst */
function zetBron(pickups: Partial<Record<"rest" | "papier" | "pmd" | "gft" | "kerstbomen", string[]>>, opties: BronOpties = {}, fixture: Fixture = BASIS): Bron {
  const perJaar: Record<number, { ophaaldatum: string; afvalstroom_id: number }[]> = {};
  for (const soort of ["rest", "papier", "pmd", "gft", "kerstbomen"] as const) {
    for (const rij of rijen(soort, pickups[soort] ?? [])) (perJaar[Number(rij.ophaaldatum.slice(0, 4))] ??= []).push(rij);
  }
  const c: NonNullable<BronOpties["c"]> = {};
  for (const jaar of [2025, 2026, 2027, 2028]) c[jaar] = { body: perJaar[jaar] ?? [] };
  bron = maakBron(fixture, { c, ...opties });
  return bron;
}

const als = <T>(userId: string, fn: () => Promise<T>) => sessie.store.run(userId, fn);

/** De lokale gateway geeft tijdstippen als "+00:00" en tijden als "21:00:00": normaliseren naar ISO / "HH:MM" */
const iso = (v: string | null) => (v === null ? null : new Date(v).toISOString());
const hhmm = (v: string | null) => (v === null ? null : v.slice(0, 5));

async function kalender(householdId: string) {
  const rows = must(await testDb().from("waste_calendars").select("*").eq("household_id", householdId), "kalender");
  const cal = rows[0];
  if (!cal) return null;
  return { ...cal, last_attempt_at: iso(cal.last_attempt_at), last_success_at: iso(cal.last_success_at)!, error_since: iso(cal.error_since), last_failure_at: iso(cal.last_failure_at), alarm_since: iso(cal.alarm_since) };
}

async function afvaltaken(householdId: string) {
  return must(
    await testDb()
      .from("tasks")
      .select("id, title, status, scheduled_date, scheduled_time, available_from, due_at, waste_pickup_date, waste_direction, waste_streams, created_by_member_id, deleted_at")
      .eq("household_id", householdId)
      .not("waste_direction", "is", null)
      .order("waste_pickup_date")
      .order("waste_direction", { ascending: false }),
    "afvaltaken",
  ).map((t) => ({ ...t, scheduled_time: hhmm(t.scheduled_time), available_from: iso(t.available_from), due_at: iso(t.due_at) }));
}

const open = (t: { status: string }) => t.status === "todo" || t.status === "in_progress";
const sleutel = (t: { waste_pickup_date: string | null; waste_direction: string | null }) => `${t.waste_pickup_date}|${t.waste_direction}`;

async function afvinkingen(householdId: string) {
  return must(await testDb().from("task_completions").select("*").eq("household_id", householdId), "historie");
}

/** Adres aanzetten via het systeem, met een vaste `now` (zoals de action doet na een geslaagde opzoeking) */
async function zetAan(gezin: Gezin, lid: string, now: Date, pickups: { rest?: string[]; papier?: string[]; pmd?: string[] }, bagId = BAG) {
  const volledig = { rest: pickups.rest ?? [], papier: pickups.papier ?? [], pmd: pickups.pmd ?? [] };
  return saveWasteCalendar({ householdId: gezin.householdId, memberId: gezin.leden[lid].memberId, postcode: "2511AB", houseNumber: 12, suffix: "", bagId, pickups: volledig, now });
}

const tick = (now: Date, tickStarted = Date.now()) => runWasteStep(testDb(), now, tickStarted);

/** De instellingen zoals de beheerder ze ziet op een vast moment (de action gebruikt de echte klok) */
const standOm = (gezin: Gezin, wie: string, now: Date) => als(gezin.leden[wie].userId, async () => getWasteSettings(await requireAdmin(), now));

async function zetKalender(householdId: string, patch: Partial<WasteCalendarRow>) {
  must(await testDb().from("waste_calendars").update(patch).eq("household_id", householdId).select("household_id"), "kalender bijwerken");
}

const stil = { daily_summary_enabled: false, evening_summary_enabled: false };
const logregels: string[] = [];

beforeEach(() => {
  push.payloads.length = 0;
  logregels.length = 0;
  bron = null;
  for (const naam of ["info", "warn", "error"] as const) {
    vi.spyOn(console, naam).mockImplementation((...args: unknown[]) => {
      logregels.push(args.map(String).join(" "));
    });
  }
});

afterEach(async () => {
  vi.restoreAllMocks();
  await ruimOp();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// =============================================================================
// AC-183, AC-219, AC-223 — aanzetten via de action
// =============================================================================
describe("AC-183: adres instellen door een beheerder", () => {
  it("(a) zoeken → bevestigen: adres bewaard, mode 'enabled', taken voor vandaag t/m +14, zonder maker (AC-219)", async () => {
    const gezin = await maakGezin("Aanzetten", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    // Leden mogen geen taken maken: de afvalkalender plant toch (AC-219)
    must(await testDb().from("households").update({ members_can_create_tasks: false }).eq("id", gezin.householdId).select("id"), "instelling");
    zetBron({ rest: [d(3), d(10)], papier: [d(5)], pmd: [d(14), d(15), d(20)] });

    const gezocht = await als(gezin.leden.Jurgen.userId, () => lookupWasteAddressAction(ADRES));
    expect(gezocht.ok && gezocht.data).toMatchObject({ kind: "found", display: "Voorbeeldstraat 12, Den Haag", suffix: "", next: { rest: d(3), papier: d(5), pmd: d(14) } });
    // Naar de browser gaan nooit de adrescode of de ruwe datums (security-review WP3b)
    expect(Object.keys(gezocht.ok ? gezocht.data : {}).sort()).toEqual(["display", "kind", "next", "suffix"]);

    const bevestigd = await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES));
    expect(bevestigd).toEqual({ ok: true, data: { kind: "saved", mode: "enabled", inserted: 8, removed: 0 } });

    const cal = await kalender(gezin.householdId);
    expect(cal).toMatchObject({ postcode: "2511AB", house_number: 12, house_suffix: "", bag_id: BAG, last_error_code: null, alarm_since: null });
    expect(cal?.pickups).toEqual({ rest: [d(3), d(10)], papier: [d(5)], pmd: [d(14), d(15), d(20)] });

    const taken = await afvaltaken(gezin.householdId);
    expect(taken.map(sleutel)).toEqual([`${d(3)}|out`, `${d(3)}|in`, `${d(5)}|out`, `${d(5)}|in`, `${d(10)}|out`, `${d(10)}|in`, `${d(14)}|out`, `${d(14)}|in`]);
    expect(taken.every((t) => t.created_by_member_id === null && t.status === "todo")).toBe(true);
    expect(taken.find((t) => sleutel(t) === `${d(3)}|out`)).toMatchObject({ title: "Restafval buitenzetten", scheduled_date: d(2), scheduled_time: "21:00", due_at: om(d(3), "07:45").toISOString() });
    expect(taken.find((t) => sleutel(t) === `${d(5)}|in`)).toMatchObject({ title: "Papierbak binnenzetten", scheduled_date: d(5), available_from: om(d(5), "12:00").toISOString() });
    // AC-218: alleen postcode-nummer of de adrescode in het pad, twee headers
    expect(bron!.verzoeken.length).toBeGreaterThanOrEqual(6);
    for (const v of bron!.verzoeken) {
      expect(v.pad).toMatch(new RegExp(`^/rest/adressen/(2511AB-12|${BAG}(/afvalstromen|/kalender/\\d{4}))$`));
      expect(v.init.headers).toEqual({ Accept: "application/json", "User-Agent": "Takenlijstje/1 (prive gezinsapp)" });
      expect(v.init.redirect).toBe("error");
    }
  });

  it("(b) eerstvolgende ophaaldag over drie weken: bewaard met 0 taken (T-90b); later komen ze vanzelf, zonder storing of stille regel", async () => {
    const gezin = await maakGezin("DrieWeken", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    zetBron({ papier: [d(21)] });
    const bevestigd = await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES));
    expect(bevestigd).toEqual({ ok: true, data: { kind: "saved", mode: "enabled", inserted: 0, removed: 0 } });
    expect(await afvaltaken(gezin.householdId)).toEqual([]);
    expect((await kalender(gezin.householdId))?.pickups).toEqual({ rest: [], papier: [d(21)], pmd: [] });

    // Een week later valt de dag binnen de 14 dagen
    const report = await tick(om(d(7), "06:10"));
    expect(report.inserted).toBe(2);
    expect((await afvaltaken(gezin.householdId)).map(sleutel)).toEqual([`${d(21)}|out`, `${d(21)}|in`]);
    const cal = await kalender(gezin.householdId);
    expect(cal?.last_error_code).toBeNull();
    const stand = await standOm(gezin, "Jurgen", om(d(7), "06:11"));
    expect(stand).toMatchObject({ role: "admin", enabled: true, health: { state: "ok" }, next: { rest: null, papier: d(21), pmd: null } });
    expect(stand.role === "admin" && stand.enabled && stand.health.notice).toBeUndefined();
    expect(await meldingenVan(gezin.householdId)).toEqual([]);
  });
});

// =============================================================================
// AC-184, AC-185, AC-186, AC-188, AC-214, AC-237 — geen opslag bij een fout
// =============================================================================
describe("opzoeken en bevestigen zonder opslag", () => {
  it("AC-184: een ongeldige invoer geeft VALIDATION en er gaat geen verzoek naar de gemeente", async () => {
    const gezin = await maakGezin("Ongeldig", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    const b = zetBron({ rest: [d(3)] });
    for (const raw of [
      { postcode: "123", houseNumber: "12", suffix: null },
      { postcode: "2511AB", houseNumber: "abc", suffix: null },
      { postcode: "2511AB", houseNumber: "0", suffix: null },
      { postcode: "2511AB", houseNumber: "12", suffix: "ABCDE" },
      { postcode: "", houseNumber: "", suffix: null },
    ]) {
      const r1 = await als(gezin.leden.Jurgen.userId, () => lookupWasteAddressAction(raw));
      const r2 = await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(raw));
      expect(r1).toMatchObject({ ok: false, code: "VALIDATION" });
      expect(r2).toMatchObject({ ok: false, code: "VALIDATION" });
    }
    expect(b.verzoeken).toHaveLength(0);
    expect(await kalender(gezin.householdId)).toBeNull();
  });

  it("AC-185/186/188/237/214: onbekend, geen bakken, onbereikbaar of geen komende dag → niets bewaard; een bestaand adres en zijn taken blijven", async () => {
    const gezin = await maakGezin("Blijft", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    const b = zetBron({ rest: [d(3)] });
    expect((await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).ok).toBe(true);
    const voor = await kalender(gezin.householdId);
    const takenVoor = await afvaltaken(gezin.householdId);
    expect(takenVoor).toHaveLength(2);
    const ander: WasteAddressInput = { postcode: "2513EF", houseNumber: "1", suffix: null };

    // AC-185: A [] → not_found (ook via bevestigen)
    b.zet({ a: { body: [] } });
    expect(await als(gezin.leden.Jurgen.userId, () => lookupWasteAddressAction(ander))).toEqual({ ok: true, data: { kind: "not_found" } });
    expect(await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ander))).toEqual({ ok: true, data: { kind: "not_found" } });
    // AC-186: alleen GFT → no_streams
    zetBron({ gft: [d(3), d(10)] });
    expect(await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).toEqual({ ok: true, data: { kind: "no_streams" } });
    // AC-188: bron onbereikbaar → unreachable (T-63b bij een bestaand adres, zelfde uitkomst)
    zetBron({}, { alles: { body: "storing", status: 503 } });
    expect(await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).toEqual({ ok: true, data: { kind: "unreachable" } });
    zetBron({}, { alles: { wacht: true } });
    expect(await als(gezin.leden.Jurgen.userId, () => lookupWasteAddressAction(ADRES))).toEqual({ ok: true, data: { kind: "unreachable" } });
    // AC-237: geen komende ophaaldag (alleen datums in het verleden) → no_upcoming
    zetBron({ rest: [d(-30), d(-7)] });
    expect(await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).toEqual({ ok: true, data: { kind: "no_upcoming" } });

    // In alle gevallen: adres, version en taken gelijk
    expect(await kalender(gezin.householdId)).toEqual(voor);
    expect(await afvaltaken(gezin.householdId)).toEqual(takenVoor);
  }, 90_000);

  it("AC-214: verhuizen vervangt de open taken; afgevinkte blijven; nooit taken van twee adressen", async () => {
    const gezin = await maakGezin("Verhuizen", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    zetBron({ rest: [d(1), d(8)] });
    expect((await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).ok).toBe(true);
    const oud = await afvaltaken(gezin.householdId);
    const uitMorgen = oud.find((t) => sleutel(t) === `${d(1)}|out`)!;
    expect((await als(gezin.leden.Jurgen.userId, () => completeTaskAction({ taskId: uitMorgen.id, mutationId: randomUUID() }))).ok).toBe(true);

    // Ander adres (nummer 12A, andere adrescode) met andere dagen
    const meerdere = laadFixture("synthetisch-meerdere-kandidaten");
    zetBron({ rest: [d(4), d(11)] }, {}, meerdere);
    const r = await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction({ postcode: "2511AB", houseNumber: "12A", suffix: null }));
    expect(r).toEqual({ ok: true, data: { kind: "saved", mode: "changed", inserted: 4, removed: 3 } });
    const cal = await kalender(gezin.householdId);
    expect(cal).toMatchObject({ bag_id: "0518200000000105", house_suffix: "A" });
    expect(cal!.version).toBeGreaterThan(0);
    const nieuw = await afvaltaken(gezin.householdId);
    expect(nieuw.filter(open).map(sleutel)).toEqual([`${d(4)}|out`, `${d(4)}|in`, `${d(11)}|out`, `${d(11)}|in`]);
    expect(nieuw.filter((t) => t.status === "done").map((t) => t.id)).toEqual([uitMorgen.id]);
    expect(await afvinkingen(gezin.householdId)).toHaveLength(1);
  });
});

// =============================================================================
// AC-189, AC-190 — rechten
// =============================================================================
describe("AC-189/AC-190: een gezinslid of uitgezet lid kan niets, en ziet alleen aan/uit", () => {
  it("alle vier de actions geven FORBIDDEN zonder één verzoek naar buiten; niets verandert", async () => {
    const gezin = await maakGezin("Lid", [
      { naam: "Jurgen", rol: "admin", prefs: stil },
      { naam: "Lynn", rol: "member", prefs: stil },
      { naam: "Kai", rol: "member", actief: false, prefs: stil },
    ]);
    zetBron({ rest: [d(3)] });
    expect((await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).ok).toBe(true);
    const voor = await kalender(gezin.householdId);
    const takenVoor = await afvaltaken(gezin.householdId);
    const b = zetBron({ rest: [d(3)] });

    for (const wie of ["Lynn", "Kai"]) {
      const user = gezin.leden[wie].userId;
      expect(await als(user, () => lookupWasteAddressAction(ADRES))).toMatchObject({ ok: false, code: "FORBIDDEN" });
      expect(await als(user, () => confirmWasteAddressAction({ postcode: "2513EF", houseNumber: "1", suffix: null }))).toMatchObject({ ok: false, code: "FORBIDDEN" });
      expect(await als(user, () => retryWasteSyncAction())).toMatchObject({ ok: false, code: "FORBIDDEN" });
      expect(await als(user, () => disableWasteCalendarAction())).toMatchObject({ ok: false, code: "FORBIDDEN" });
    }
    expect(b.verzoeken).toHaveLength(0);

    // D-048: de hercontrole vlak vóór waste_sync met de service role
    await expect(syncHousehold(gezin.householdId, gezin.leden.Lynn.memberId, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(applyConfirmedSameAddress(gezin.householdId, gezin.leden.Lynn.memberId, voor!.version, voor!.pickups, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(applyConfirmedSameAddress(gezin.householdId, gezin.leden.Kai.memberId, voor!.version, voor!.pickups, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(await kalender(gezin.householdId)).toEqual(voor);
    expect(await afvaltaken(gezin.householdId)).toEqual(takenVoor);

    // AC-190: Lynn ziet alleen aan/uit en de beheerders; geen adres, gezondheid of datums
    const lynn = await als(gezin.leden.Lynn.userId, () => getWasteSettingsAction());
    expect(lynn).toEqual({ ok: true, data: { role: "member", enabled: true, adminNames: ["Jurgen"] } });
    expect(JSON.stringify(lynn)).not.toMatch(/2511|0518200000000101|Voorbeeldstraat/);
    // Kai (uitgezet) krijgt zelfs dat niet
    expect(await als(gezin.leden.Kai.userId, () => getWasteSettingsAction())).toMatchObject({ ok: false, code: "FORBIDDEN" });
    // Jurgen ziet alles
    const jurgen = await als(gezin.leden.Jurgen.userId, () => getWasteSettingsAction());
    expect(jurgen.ok && jurgen.data).toMatchObject({ role: "admin", enabled: true, address: { postcode: "2511AB", houseNumber: 12, suffix: "", label: "2511 AB 12" }, health: { state: "ok" }, next: { rest: d(3) }, openTasks: 2 });
  });

  it("een beheerder die tijdens het instellen zijn rol verliest, krijgt bij bevestigen FORBIDDEN (T-66) en er is niets bewaard", async () => {
    const gezin = await maakGezin("Rolweg", [
      { naam: "Jurgen", rol: "admin", prefs: stil },
      { naam: "Ellen", rol: "admin", prefs: stil },
    ]);
    zetBron({ rest: [d(3)] });
    expect((await als(gezin.leden.Jurgen.userId, () => lookupWasteAddressAction(ADRES))).ok).toBe(true);
    must(await testDb().from("household_members").update({ role: "member" }).eq("id", gezin.leden.Jurgen.memberId).select("id"), "degraderen");
    expect(await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await kalender(gezin.householdId)).toBeNull();
    expect(await afvaltaken(gezin.householdId)).toEqual([]);
    expect(await als(gezin.leden.Jurgen.userId, () => getWasteSettingsAction())).toEqual({ ok: true, data: { role: "member", enabled: false, adminNames: ["Ellen"] } });
  });
});

// =============================================================================
// AC-191 — dubbel bevestigen en twee beheerders tegelijk
// =============================================================================
describe("AC-191: twee keer snel bevestigen en twee beheerders tegelijk", () => {
  it("er blijft precies één adres over, met alleen taken van dat adres en zonder dubbele (dag, richting)", async () => {
    const gezin = await maakGezin("Tegelijk", [
      { naam: "Jurgen", rol: "admin", prefs: stil },
      { naam: "Ellen", rol: "admin", prefs: stil },
    ]);
    // Nummer 12 (kaal) heeft rest op +3, nummer 12A op +5: per adrescode een eigen kalender
    const fixture = laadFixture("synthetisch-meerdere-kandidaten");
    const verzoeken: string[] = [];
    bron = maakBron(fixture, {
      alles: (url) => {
        verzoeken.push(url);
        const pad = url.slice(BRON_HOST.length);
        if (/\/kalender\/\d{4}$/.test(pad)) {
          const jaar = pad.slice(-4);
          const bag = pad.split("/")[3];
          const datum = bag === "0518200000000104" ? d(3) : d(5);
          return new Response(JSON.stringify(datum.startsWith(jaar) ? rijen("rest", [datum]) : []), { headers: { "content-type": "application/json" } });
        }
        if (pad.endsWith("/afvalstromen")) return new Response(JSON.stringify(fixture.afvalstromen), { headers: { "content-type": "application/json" } });
        return new Response(JSON.stringify(fixture.adres), { headers: { "content-type": "application/json" } });
      },
    });
    const kaal: WasteAddressInput = { postcode: "2511AB", houseNumber: "12", suffix: "" };
    const metA: WasteAddressInput = { postcode: "2511AB", houseNumber: "12", suffix: "A" };
    const uitkomsten = await Promise.all([
      als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(kaal)),
      als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(kaal)),
      als(gezin.leden.Ellen.userId, () => confirmWasteAddressAction(metA)),
    ]);
    for (const u of uitkomsten) expect(u.ok).toBe(true);

    const cal = await kalender(gezin.householdId);
    expect(cal).not.toBeNull();
    const rijenKal = must(await testDb().from("waste_calendars").select("household_id").eq("household_id", gezin.householdId), "kalenders");
    expect(rijenKal).toHaveLength(1);
    const winnaar = cal!.bag_id === "0518200000000104" ? d(3) : d(5);
    const taken = (await afvaltaken(gezin.householdId)).filter(open);
    expect(taken.map(sleutel).sort()).toEqual([`${winnaar}|in`, `${winnaar}|out`]);
    expect(new Set(taken.map(sleutel)).size).toBe(taken.length);
  });
});

// =============================================================================
// AC-197, AC-203, AC-221 — plannen en ophaalmomenten (tick met vaste tijd)
// =============================================================================
describe("AC-197: 14 dagen vooruit en nooit dubbel", () => {
  const N = om("2026-10-05", "06:10");

  it("twee keer na elkaar en twee keer tegelijk: taken voor +3 en +14, niet +15; de volgende dag komt +15 erbij", async () => {
    const gezin = await maakGezin("Horizon", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    zetBron({ rest: ["2026-10-08", "2026-10-19", "2026-10-20"] });
    // Aangezet vóór het ophaalmoment van 06:00, nog zonder datums: de tick haalt op en plant
    await zetAan(gezin, "Jurgen", om("2026-10-05", "04:50"), {});
    const eerste = await tick(N);
    const tweede = await tick(new Date(N.getTime() + 15 * 60_000));
    expect(eerste).toMatchObject({ fetched: 1, inserted: 4 });
    expect(tweede).toMatchObject({ fetched: 0, inserted: 0 });
    expect((await afvaltaken(gezin.householdId)).map(sleutel)).toEqual(["2026-10-08|out", "2026-10-08|in", "2026-10-19|out", "2026-10-19|in"]);
    expect(await meldingenVan(gezin.householdId)).toEqual([]);

    const N2 = om("2026-10-05", "17:10");
    await Promise.all([tick(N2), tick(N2)]);
    expect((await afvaltaken(gezin.householdId)).map(sleutel)).toEqual(["2026-10-08|out", "2026-10-08|in", "2026-10-19|out", "2026-10-19|in"]);

    const morgen = await tick(om("2026-10-06", "06:10"));
    expect(morgen.inserted).toBe(2);
    expect((await afvaltaken(gezin.householdId)).map(sleutel)).toContain("2026-10-20|out");
    expect(await afvaltaken(gezin.householdId)).toHaveLength(6);
  });
});

describe("AC-203/AC-221: een nieuwe ophaaldag laat ontdekt, en een wijziging overdag", () => {
  it("(a) di 21:40 → buiten én binnen; (c) wo 08:00 → alleen binnen; (e) do 00:10 → niets", async () => {
    const gezin = await maakGezin("Laat", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    await zetAan(gezin, "Jurgen", om("2026-10-06", "06:05"), { rest: ["2026-10-14"] });
    zetBron({ rest: ["2026-10-07", "2026-10-14"] });
    const a = await tick(om("2026-10-06", "21:40"));
    expect(a.fetched).toBe(1);
    expect((await afvaltaken(gezin.householdId)).map(sleutel)).toEqual(["2026-10-07|out", "2026-10-07|in", "2026-10-14|out", "2026-10-14|in"]);
    await ruimOp();

    const gezinC = await maakGezin("LaatC", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    await zetAan(gezinC, "Jurgen", om("2026-10-06", "06:05"), { rest: ["2026-10-14"] });
    await tick(om("2026-10-07", "08:00"));
    expect((await afvaltaken(gezinC.householdId)).filter((t) => t.waste_pickup_date === "2026-10-07").map(sleutel)).toEqual(["2026-10-07|in"]);
    await ruimOp();

    const gezinE = await maakGezin("LaatE", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    await zetAan(gezinE, "Jurgen", om("2026-10-06", "06:05"), { rest: ["2026-10-14"] });
    await tick(om("2026-10-08", "00:10"));
    expect((await afvaltaken(gezinE.householdId)).filter((t) => t.waste_pickup_date === "2026-10-07")).toEqual([]);
  });

  it("AC-221: na een geslaagde ophaling om 06:05 wordt tot 17:00 niet opnieuw opgevraagd; om 17:10 wel, en de taak voor morgen staat er", async () => {
    const gezin = await maakGezin("Overdag", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    await zetAan(gezin, "Jurgen", om("2026-10-05", "06:05"), { rest: ["2026-10-13"] });
    const b = zetBron({ rest: ["2026-10-06", "2026-10-13"] }); // om 14:00 online gezet
    expect((await tick(om("2026-10-05", "12:00"))).fetched).toBe(0);
    expect((await tick(om("2026-10-05", "14:30"))).fetched).toBe(0);
    expect(b.verzoeken).toHaveLength(0);
    const r = await tick(om("2026-10-05", "17:10"));
    expect(r.fetched).toBe(1);
    expect((await afvaltaken(gezin.householdId)).find((t) => sleutel(t) === "2026-10-06|out")).toMatchObject({ scheduled_date: "2026-10-05", scheduled_time: "21:00" });
  });
});

// =============================================================================
// AC-198…AC-202 — de gemeente verandert de agenda
// =============================================================================
describe("AC-198: verschoven ophaaldag (feestdag)", () => {
  it("dezelfde taken schuiven mee; notitie en 'bezig' blijven; geen historie; herinnering op het nieuwe moment", async () => {
    const gezin = await maakGezin("Kerst", [
      { naam: "Jurgen", rol: "admin", prefs: stil },
      { naam: "Ellen", rol: "admin", prefs: stil },
    ]);
    const N = om("2026-12-15", "06:05");
    zetBron({ rest: ["2026-12-25"] });
    await zetAan(gezin, "Jurgen", N, { rest: ["2026-12-25"] });
    const [uit, binnen] = await afvaltaken(gezin.householdId);
    expect(sleutel(uit)).toBe("2026-12-25|out");
    expect((await als(gezin.leden.Ellen.userId, () => addCommentAction({ taskId: uit.id, body: "Container staat al klaar" }))).ok).toBe(true);
    expect((await als(gezin.leden.Ellen.userId, () => setTaskStatusAction(uit.id, "in_progress"))).ok).toBe(true);

    zetBron({ rest: ["2026-12-26"] });
    const r = await tick(om("2026-12-15", "17:10"));
    expect(r).toMatchObject({ fetched: 1, moved: 2, removed: 0, inserted: 0, renamed: 0 });
    const na = await afvaltaken(gezin.householdId);
    expect(na.map((t) => t.id).sort()).toEqual([uit.id, binnen.id].sort());
    expect(na.find((t) => t.id === uit.id)).toMatchObject({ status: "in_progress", scheduled_date: "2026-12-25", waste_pickup_date: "2026-12-26", due_at: om("2026-12-26", "07:45").toISOString() });
    expect(na.find((t) => t.id === binnen.id)).toMatchObject({ status: "todo", scheduled_date: "2026-12-26", waste_pickup_date: "2026-12-26" });
    expect(must(await testDb().from("task_comments").select("id").eq("task_id", uit.id), "notities")).toHaveLength(1);
    expect(await afvinkingen(gezin.householdId)).toEqual([]);

    // Herinnering op het nieuwe moment: vrijdag 25 december 21:00 (buiten), niet donderdag
    await runTick(om("2026-12-24", "21:05"));
    expect((await meldingenVan(gezin.householdId)).filter((m) => m.type === "reminder")).toEqual([]);
    await runTick(om("2026-12-25", "21:05"));
    const herinneringen = (await meldingenVan(gezin.householdId)).filter((m) => m.type === "reminder");
    expect(herinneringen.map((m) => m.title)).toEqual(["Herinnering: Restafval buitenzetten", "Herinnering: Restafval buitenzetten"]);
    expect(herinneringen.every((m) => m.dedupe_key === `waste:${uit.id}:${om("2026-12-25", "21:00").toISOString()}`)).toBe(true);
  });
});

describe("AC-199/AC-200/AC-201/AC-202: dag verdwijnt, bak buiten, bak erbij of eraf, gedaan blijft", () => {
  const N = om("2026-10-05", "06:05");

  it("AC-199: beide open taken van een verdwenen dag gaan hard weg, zonder historie; de andere dag blijft", async () => {
    const gezin = await maakGezin("Weg", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    await zetAan(gezin, "Jurgen", N, { rest: ["2026-10-08", "2026-10-13"] });
    zetBron({ rest: ["2026-10-13"] });
    const r = await tick(om("2026-10-05", "17:10"));
    expect(r).toMatchObject({ removed: 2, moved: 0, inserted: 0 });
    const na = await afvaltaken(gezin.householdId);
    expect(na.map(sleutel)).toEqual(["2026-10-13|out", "2026-10-13|in"]);
    expect(na.every((t) => t.deleted_at === null)).toBe(true);
    expect(await afvinkingen(gezin.householdId)).toEqual([]);
    expect(must(await testDb().from("tasks").select("id").eq("household_id", gezin.householdId), "alle taken")).toHaveLength(2);
  });

  it("AC-200: buiten is gedaan en de dag verschuift naar woensdag → binnen blijft dinsdag, woensdag krijgt nieuwe taken", async () => {
    const gezin = await maakGezin("Buiten", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    await zetAan(gezin, "Jurgen", N, { rest: ["2026-10-06"] });
    const [uit, binnen] = await afvaltaken(gezin.householdId);
    expect((await als(gezin.leden.Jurgen.userId, () => completeTaskAction({ taskId: uit.id, mutationId: randomUUID(), completedAt: om("2026-10-05", "22:10").toISOString() }))).ok).toBe(true);
    zetBron({ rest: ["2026-10-07"] });
    const r = await tick(om("2026-10-05", "17:10"));
    expect(r).toMatchObject({ moved: 0, removed: 0, inserted: 2 });
    const na = await afvaltaken(gezin.householdId);
    expect(na.find((t) => t.id === uit.id)).toMatchObject({ status: "done", waste_pickup_date: "2026-10-06" });
    expect(na.find((t) => t.id === binnen.id)).toMatchObject({ status: "todo", waste_pickup_date: "2026-10-06", scheduled_date: "2026-10-06" });
    expect(na.filter((t) => t.waste_pickup_date === "2026-10-07").map(sleutel)).toEqual(["2026-10-07|out", "2026-10-07|in"]);
    expect(await afvinkingen(gezin.householdId)).toHaveLength(1);
  });

  it("AC-201: papier valt weg → dezelfde taken heten 'Restafval …', met dezelfde notitie; AC-202: gedaan en overgeslagen blijven ongewijzigd", async () => {
    const gezin = await maakGezin("Hernoem", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    await zetAan(gezin, "Jurgen", N, { rest: ["2026-10-08", "2026-10-15"], papier: ["2026-10-08", "2026-10-15"] });
    const taken = await afvaltaken(gezin.householdId);
    expect(taken.map((t) => t.title)).toEqual(["Restafval en papier buitenzetten", "Restafval- en papierbak binnenzetten", "Restafval en papier buitenzetten", "Restafval- en papierbak binnenzetten"]);
    const [uit8, in8, uit15, in15] = taken;
    expect((await als(gezin.leden.Jurgen.userId, () => addCommentAction({ taskId: uit8.id, body: "Papier zit al in de bak" }))).ok).toBe(true);
    expect((await als(gezin.leden.Jurgen.userId, () => completeTaskAction({ taskId: uit15.id, mutationId: randomUUID() }))).ok).toBe(true);
    expect((await als(gezin.leden.Jurgen.userId, () => setTaskStatusAction(in15.id, "skipped"))).ok).toBe(true);

    zetBron({ rest: ["2026-10-08", "2026-10-15"] });
    const r = await tick(om("2026-10-05", "17:10"));
    expect(r).toMatchObject({ renamed: 2, removed: 0, moved: 0, inserted: 0 });
    const na = await afvaltaken(gezin.householdId);
    expect(na.find((t) => t.id === uit8.id)).toMatchObject({ title: "Restafval buitenzetten", waste_streams: ["rest"], status: "todo" });
    expect(na.find((t) => t.id === in8.id)).toMatchObject({ title: "Restafvalbak binnenzetten", waste_streams: ["rest"] });
    expect(na.find((t) => t.id === uit15.id)).toMatchObject({ title: "Restafval en papier buitenzetten", status: "done", waste_streams: ["rest", "papier"] });
    expect(na.find((t) => t.id === in15.id)).toMatchObject({ title: "Restafval- en papierbak binnenzetten", status: "skipped" });
    expect(must(await testDb().from("task_comments").select("id").eq("task_id", uit8.id), "notities")).toHaveLength(1);
    expect(na).toHaveLength(4);
  });
});

// =============================================================================
// AC-204 — bron tijdelijk onbereikbaar, onbruikbaar of leeg
// =============================================================================
describe("AC-204: storing bij het bijwerken", () => {
  const N = om("2026-10-05", "06:05");

  it.each([
    ["500", { alles: { body: "storing", status: 500 } } as BronOpties],
    ["time-out", { alles: { wacht: true } } as BronOpties],
    ["kapotte C met andere dagen", { c: { 2026: { raw: '[{"ophaaldatum":"2026-10-09","afvalstroom_id":4}' } } } as BronOpties],
    ["kapotte B", { b: { raw: "<html>", contentType: "text/html" } } as BronOpties],
    ["leeg", { c: { 2026: { body: [] }, 2027: { body: [] } } } as BronOpties],
  ])("%s: adres en datums gelijk; geen taak verwijderd, verschoven of hernoemd; een bewaarde dag schuift het venster in", async (_naam, opties) => {
    const gezin = await maakGezin("Storing", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    // Bewaarde ophaaldagen: +3 (taken klaar) en +15 (nog niet)
    await zetAan(gezin, "Jurgen", N, { rest: ["2026-10-08", "2026-10-20"] });
    const voor = await kalender(gezin.householdId);
    const takenVoor = await afvaltaken(gezin.householdId);
    expect(takenVoor).toHaveLength(2);
    zetBron({ rest: ["2026-10-08", "2026-10-20"] }, opties);

    const r = await tick(om("2026-10-05", "17:10"));
    expect(r).toMatchObject({ fetched: 1, fetchFailed: 1, removed: 0, moved: 0, renamed: 0, inserted: 0, alerted: 0 });
    const na = await kalender(gezin.householdId);
    expect(na).toMatchObject({ postcode: voor!.postcode, bag_id: voor!.bag_id, pickups: voor!.pickups, version: voor!.version, alarm_since: null });
    // D-047: een kapotte B blijft FORMAT; een kapotte C geeft UNREACHABLE
    expect(na!.last_error_code).toBe(_naam === "leeg" ? "SUSPECT_EMPTY" : _naam === "kapotte B" ? "FORMAT" : "UNREACHABLE");
    expect(na!.last_failure_at).toBe(om("2026-10-05", "17:10").toISOString());
    expect(na!.error_since).toBe(om("2026-10-05", "17:10").toISOString());
    expect(await afvaltaken(gezin.householdId)).toEqual(takenVoor);
    // Eén mislukking is geen storing: T-71 (retrying), geen melding
    expect(await standOm(gezin, "Jurgen", om("2026-10-05", "17:11"))).toMatchObject({ health: { state: "retrying" } });
    expect(await meldingenVan(gezin.householdId)).toEqual([]);

    // De volgende dag, nog steeds storing: de bewaarde dag +15 valt nu binnen 14 dagen → taken klaargezet
    const morgen = await tick(om("2026-10-06", "06:10"));
    expect(morgen).toMatchObject({ fetchFailed: 1, inserted: 2, removed: 0, moved: 0, renamed: 0 });
    expect((await afvaltaken(gezin.householdId)).map(sleutel)).toEqual(["2026-10-08|out", "2026-10-08|in", "2026-10-20|out", "2026-10-20|in"]);
    // De log bevat alleen codes en tellingen
    expect(logregels.some((r) => r.includes("[waste] ophalen mislukt code="))).toBe(true);
    for (const regel of logregels) expect(regel).not.toMatch(/2511|0518200000000101|Voorbeeldstraat|huisvuilkalender/);
  });

  it("adres weg (B {}): ADDRESS_GONE, T-71b; BR-54 loopt door; opnieuw geprobeerd binnen 75 minuten", async () => {
    const gezin = await maakGezin("AdresWeg", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    await zetAan(gezin, "Jurgen", om("2026-10-04", "06:05"), { rest: ["2026-10-04", "2026-10-13"] });
    // Een vergeten buitenzet-taak van gisteren (ophaaldag 4 oktober) staat nog open
    const gisteren = (await afvaltaken(gezin.householdId)).find((t) => sleutel(t) === "2026-10-04|out");
    expect(gisteren).toBeDefined();
    const b = zetBron({}, { b: { body: {} } });

    const r = await tick(om("2026-10-05", "06:10"));
    expect(r).toMatchObject({ fetched: 1, fetchFailed: 1, expired: 1, removed: 0 });
    expect((await kalender(gezin.householdId))?.last_error_code).toBe("ADDRESS_GONE");
    const na = await afvaltaken(gezin.householdId);
    expect(na.find((t) => t.id === gisteren!.id)?.status).toBe("skipped");
    // Binnenzetten van 4 oktober blijft open (het systeem geeft geen doorwerking)
    expect(na.find((t) => sleutel(t) === "2026-10-04|in")?.status).toBe("todo");
    expect(await standOm(gezin, "Jurgen", om("2026-10-05", "06:11"))).toMatchObject({ health: { state: "retrying", lastErrorCode: "ADDRESS_GONE" } });

    // Niet vaker dan elk uur: 07:00 nog niet, 07:15 wel (≤ 75 minuten na de mislukking)
    const teller = b.verzoeken.length;
    expect((await tick(om("2026-10-05", "07:00"))).fetched).toBe(0);
    expect(b.verzoeken.length).toBe(teller);
    expect((await tick(om("2026-10-05", "07:15"))).fetched).toBe(1);
    expect(b.verzoeken.length).toBeGreaterThan(teller);
  });

  it("regressie P0: twee ticks op 5 oktober 2026 → geen leeg antwoord, geen melding; 2027 wordt niet opgevraagd", async () => {
    const gezin = await maakGezin("P0Okt", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    const b = (bron = maakBron(laadFixture("p0-2591BB-87")));
    const gezocht = await lookupWasteCalendar({ postcode: "2591BB", houseNumber: 87, suffix: null }, om("2026-10-05", "06:00"), TZ, {});
    expect(gezocht.kind).toBe("found");
    if (gezocht.kind !== "found") return;
    await saveWasteCalendar({ householdId: gezin.householdId, memberId: gezin.leden.Jurgen.memberId, postcode: "2591BB", houseNumber: 87, suffix: "", bagId: gezocht.bagId, pickups: gezocht.pickups, now: om("2026-10-05", "06:00") });
    const r1 = await tick(om("2026-10-05", "06:10"));
    const r2 = await tick(om("2026-10-05", "17:10"));
    expect(r1.fetchFailed + r2.fetchFailed).toBe(0);
    expect(r2.fetched).toBe(1);
    expect((await kalender(gezin.householdId))?.last_error_code).toBeNull();
    expect(await meldingenVan(gezin.householdId)).toEqual([]);
    expect(b.teller("/kalender/2027")).toBe(0);
    expect(await afvaltaken(gezin.householdId)).toEqual([]);
  });

  it("regressie P0 eind november: geen storing, geen melding, wel de stille regel T-73; 2027 wordt opgevraagd", async () => {
    const gezin = await maakGezin("P0Nov", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    const b = (bron = maakBron(laadFixture("p0-2591BB-87")));
    const gezocht = await lookupWasteCalendar({ postcode: "2591BB", houseNumber: 87, suffix: null }, om("2026-11-20", "06:00"), TZ, {});
    expect(gezocht.kind).toBe("found");
    if (gezocht.kind !== "found") return;
    await saveWasteCalendar({ householdId: gezin.householdId, memberId: gezin.leden.Jurgen.memberId, postcode: "2591BB", houseNumber: 87, suffix: "", bagId: gezocht.bagId, pickups: gezocht.pickups, now: om("2026-11-20", "06:00") });
    for (const moment of [om("2026-11-26", "06:10"), om("2026-11-26", "17:10"), om("2026-11-27", "06:10")]) {
      const r = await tick(moment);
      expect(r.fetchFailed).toBe(0);
      expect(r.alerted).toBe(0);
    }
    expect((await kalender(gezin.householdId))).toMatchObject({ last_error_code: null, alarm_since: null });
    expect(b.teller("/kalender/2027")).toBeGreaterThanOrEqual(1);
    expect(await meldingenVan(gezin.householdId)).toEqual([]);
    expect(await standOm(gezin, "Jurgen", om("2026-11-27", "06:11"))).toMatchObject({ health: { state: "ok", notice: "next_year_missing" } });
  });
});

// =============================================================================
// AC-205, AC-212, AC-223 — storing per oorzaak, één melding, zonder adres
// =============================================================================
describe("AC-205: storing per oorzaak", () => {
  const N = om("2026-10-05", "06:05");
  const gezinMet = (label: string) =>
    maakGezin(label, [
      { naam: "Jurgen", rol: "admin", prefs: stil },
      { naam: "Ellen", rol: "admin", prefs: { ...stil, notify_reminders: false } },
      { naam: "Lynn", rol: "member", prefs: stil },
    ]);

  it("(a) meer dan 48 uur onbereikbaar → H1 en één M-03 voor Jurgen en Ellen, niets voor Lynn; niet opnieuw per ronde; na herstel en een nieuwe storing opnieuw één", async () => {
    const gezin = await gezinMet("Stale");
    await zetAan(gezin, "Jurgen", N, { rest: ["2026-10-08"] });
    zetBron({}, { alles: { body: "storing", status: 503 } });
    for (const moment of [om("2026-10-05", "17:10"), om("2026-10-06", "06:10"), om("2026-10-06", "17:10"), om("2026-10-07", "06:04")]) {
      expect((await tick(moment)).alerted).toBe(0);
    }
    expect(await meldingenVan(gezin.householdId)).toEqual([]);
    // 48 uur + 1 minuut na het laatste succes
    const r = await tick(om("2026-10-07", "06:06"));
    expect(r.alerted).toBe(1);
    const meldingen = await meldingenVan(gezin.householdId);
    expect(meldingen.map((m) => m.member_id).sort()).toEqual([gezin.leden.Ellen.memberId, gezin.leden.Jurgen.memberId].sort());
    for (const m of meldingen) {
      expect(m).toMatchObject({
        type: "waste_sync_failed",
        title: "De afvalkalender kon niet worden bijgewerkt",
        body: "Laatst gelukt op ma 5 okt. Nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl.",
      });
    }
    const url = must(await testDb().from("notifications").select("url").eq("household_id", gezin.householdId), "url");
    expect(url.every((u) => u.url === appUrl.wasteSettings() && u.url === "/instellingen/afvalkalender")).toBe(true); // AC-223
    expect((await kalender(gezin.householdId))?.alarm_since).toBe(om("2026-10-07", "06:06").toISOString());
    expect(await standOm(gezin, "Jurgen", om("2026-10-07", "06:07"))).toMatchObject({ health: { state: "failed", reason: "stale", variant: "H1" } });

    // Volgende rondes, ook met een andere oorzaak (adres weg): geen nieuwe melding, balk blijft
    zetBron({}, { b: { body: {} } });
    for (const moment of [om("2026-10-07", "07:15"), om("2026-10-07", "17:10"), om("2026-10-08", "06:10")]) expect((await tick(moment)).alerted).toBe(0);
    expect(await meldingenVan(gezin.householdId)).toHaveLength(2);
    expect(await standOm(gezin, "Jurgen", om("2026-10-08", "06:11"))).toMatchObject({ health: { state: "failed", variant: "H3", lastErrorCode: "ADDRESS_GONE" } });

    // Herstel: balk weg, geen melding "weer gelukt"
    zetBron({ rest: ["2026-10-13"] });
    const hersteld = await tick(om("2026-10-08", "17:10"));
    expect(hersteld).toMatchObject({ fetchFailed: 0, alerted: 0 });
    expect(await kalender(gezin.householdId)).toMatchObject({ last_error_code: null, error_since: null, last_failure_at: null, alarm_since: null });
    expect(await meldingenVan(gezin.householdId)).toHaveLength(2);

    // Nieuwe storing, weer 48 uur: opnieuw één melding per beheerder
    zetBron({}, { alles: { body: "storing", status: 503 } });
    await tick(om("2026-10-09", "06:10"));
    await tick(om("2026-10-10", "06:10"));
    expect((await tick(om("2026-10-10", "17:12"))).alerted).toBe(1);
    expect(await meldingenVan(gezin.householdId)).toHaveLength(4);
    expect((await meldingenVan(gezin.householdId)).filter((m) => m.member_id === gezin.leden.Lynn.memberId)).toEqual([]);

    // AC-212: nergens het adres, de adrescode, de straat of een naam
    const alles = [
      ...(await meldingenVan(gezin.householdId)).flatMap((m) => [m.title, m.body ?? "", m.dedupe_key ?? ""]),
      ...push.payloads,
      ...(await afvaltaken(gezin.householdId)).map((t) => t.title),
      ...(await afvinkingen(gezin.householdId)).map((c) => c.title),
      ...logregels,
    ];
    for (const tekst of alles) expect(tekst).not.toMatch(/2511|\b12\b.*AB|0518200000000101|Voorbeeldstraat|Jurgen|Ellen|Lynn/);
  }, 90_000);

  it("(b) twee lege antwoorden minstens een uur uit elkaar → H2 en M-04; de bewaarde datums blijven zichtbaar; daarna UNREACHABLE → blijft failed", async () => {
    const gezin = await gezinMet("Leeg");
    await zetAan(gezin, "Jurgen", N, { rest: ["2026-10-08", "2026-10-15"], papier: ["2026-10-21"] });
    zetBron({});
    expect((await tick(om("2026-10-05", "17:10"))).alerted).toBe(0);
    expect((await tick(om("2026-10-05", "17:40"))).fetched).toBe(0); // nog geen uur: geen poging
    const r = await tick(om("2026-10-05", "18:15"));
    expect(r).toMatchObject({ fetched: 1, alerted: 1 });
    const meldingen = await meldingenVan(gezin.householdId);
    expect(meldingen).toHaveLength(2);
    expect(meldingen[0]).toMatchObject({ type: "waste_sync_failed", body: "De gemeente geeft geen komende ophaaldagen meer. Soms staat de nieuwe kalender nog niet online. Kijk zelf op huisvuilkalender.denhaag.nl." });
    expect(await standOm(gezin, "Jurgen", om("2026-10-05", "18:16"))).toMatchObject({ health: { state: "failed", reason: "empty", variant: "H2" }, next: { rest: "2026-10-08", papier: "2026-10-21", pmd: null } });
    // Niet per ronde opnieuw
    expect((await tick(om("2026-10-05", "19:20"))).alerted).toBe(0);
    // Daarna onbereikbaar: de balk blijft (held)
    zetBron({}, { alles: { netwerkfout: true } });
    expect((await tick(om("2026-10-05", "20:25"))).alerted).toBe(0);
    expect(await standOm(gezin, "Jurgen", om("2026-10-05", "20:26"))).toMatchObject({ health: { state: "failed", reason: "held", variant: "H1" } });
    expect(await meldingenVan(gezin.householdId)).toHaveLength(2);
    // Lynn ziet geen balk en krijgt geen melding
    expect(await als(gezin.leden.Lynn.userId, () => getWasteSettingsAction())).toEqual({ ok: true, data: { role: "member", enabled: true, adminNames: ["Ellen", "Jurgen"] } });
  });

  it("(c) laatste succes > 48 uur geleden zonder vastgelegde mislukking (tick lag stil, ophaalstap overgeslagen door het budget) → M-03", async () => {
    const gezin = await gezinMet("Stil");
    await zetAan(gezin, "Jurgen", om("2026-10-02", "06:05"), { rest: ["2026-10-08"] });
    zetBron({ rest: ["2026-10-08"] });
    // Tick die al 11 s loopt: geen ophaling meer, wel de storingscontrole
    const r = await tick(om("2026-10-05", "06:10"), Date.now() - 11_000);
    expect(r).toMatchObject({ fetched: 0, alerted: 1 });
    const meldingen = await meldingenVan(gezin.householdId);
    expect(meldingen).toHaveLength(2);
    expect(meldingen[0].title).toBe("De afvalkalender kon niet worden bijgewerkt");
    expect((await kalender(gezin.householdId))).toMatchObject({ last_error_code: null, alarm_since: om("2026-10-05", "06:10").toISOString() });
  });
});

// =============================================================================
// AC-207, AC-208, AC-209 — wat wel en niet kan met een afvaltaak
// =============================================================================
describe("AC-207/AC-208/AC-209: afvinken, weigeren, overslaan", () => {
  it("AC-207: Lynn vinkt binnenzetten af, Kai draait het terug; buitenzetten blijft; historie zonder persoon", async () => {
    const gezin = await maakGezin("Afvinken", [
      { naam: "Jurgen", rol: "admin", prefs: stil },
      { naam: "Lynn", rol: "member", prefs: stil },
      { naam: "Kai", rol: "member", prefs: stil },
    ]);
    zetBron({ rest: [d(2)] });
    expect((await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).ok).toBe(true);
    const [uit, binnen] = await afvaltaken(gezin.householdId);
    const gedaan = await als(gezin.leden.Lynn.userId, () => completeTaskAction({ taskId: binnen.id, mutationId: randomUUID() }));
    expect(gedaan.ok).toBe(true);
    let na = await afvaltaken(gezin.householdId);
    expect(na.find((t) => t.id === uit.id)?.status).toBe("todo");
    expect(na.find((t) => t.id === binnen.id)?.status).toBe("done");
    const historie = await afvinkingen(gezin.householdId);
    expect(historie).toHaveLength(1);
    expect(Object.keys(historie[0]).filter((k) => /member|completed_by|user/.test(k))).toEqual([]);

    expect((await als(gezin.leden.Kai.userId, () => undoCompleteAction(binnen.id))).ok).toBe(true);
    na = await afvaltaken(gezin.householdId);
    expect(na.find((t) => t.id === binnen.id)?.status).toBe("todo");
    expect(na.find((t) => t.id === uit.id)?.status).toBe("todo");
    expect(await afvinkingen(gezin.householdId)).toEqual([]);
  });

  it("AC-208: hernoemen, verplaatsen, verwijderen en 'wordt terugkerend' → FORBIDDEN met T-33; status, notitie en overslaan lukken wel", async () => {
    const gezin = await maakGezin("Verboden", [
      { naam: "Jurgen", rol: "admin", prefs: stil },
      { naam: "Lynn", rol: "member", prefs: stil },
    ]);
    zetBron({ rest: [d(2)] });
    expect((await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).ok).toBe(true);
    const voor = await afvaltaken(gezin.householdId);
    const [uit] = voor;
    for (const wie of ["Jurgen", "Lynn"]) {
      const user = gezin.leden[wie].userId;
      const weigeringen = [
        await als(user, () => moveTaskAction(uit.id, d(5))),
        await als(user, () => updateTaskAction({ taskId: uit.id, changes: { title: "Gewoon iets anders" } })),
        await als(user, () => updateTaskAction({ taskId: uit.id, changes: { scheduledDate: d(6), dueDate: d(6), dueTime: "10:00" } })),
        await als(user, () => updateTaskAction({ taskId: uit.id, changes: { recurrence: { rule: { freq: "weekly", interval: 1, weekdays: [2] } } } })),
        await als(user, () => deleteTaskAction(uit.id)),
        await als(user, () => deleteTaskAction(uit.id, "future")),
      ];
      for (const w of weigeringen) expect(w).toEqual({ ok: false, code: "FORBIDDEN", error: WASTE_TEXT.forbidden });
    }
    expect(await afvaltaken(gezin.householdId)).toEqual(voor);
    expect(must(await testDb().from("task_recurrences").select("id").eq("household_id", gezin.householdId), "reeksen")).toEqual([]);

    // Wat wel mag
    expect((await als(gezin.leden.Lynn.userId, () => setTaskStatusAction(uit.id, "in_progress"))).ok).toBe(true);
    expect((await als(gezin.leden.Lynn.userId, () => addCommentAction({ taskId: uit.id, body: "Bak staat bij de buren" }))).ok).toBe(true);
    expect((await als(gezin.leden.Lynn.userId, () => setTaskStatusAction(uit.id, "todo"))).ok).toBe(true);
  });

  it("AC-209: buitenzetten overslaan neemt binnenzetten mee; om 18:00 geen herinnering; ongedaan maken zet beide open", async () => {
    const gezin = await maakGezin("Overslaan", [
      { naam: "Jurgen", rol: "admin", prefs: stil },
      { naam: "Lynn", rol: "member", prefs: stil },
    ]);
    zetBron({ rest: [d(1)] });
    expect((await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).ok).toBe(true);
    const [uit, binnen] = await afvaltaken(gezin.householdId);
    expect((await als(gezin.leden.Lynn.userId, () => setTaskStatusAction(uit.id, "skipped"))).ok).toBe(true);
    let na = await afvaltaken(gezin.householdId);
    expect(na.map((t) => t.status)).toEqual(["skipped", "skipped"]);

    await runTick(om(d(1), "18:02"));
    expect((await meldingenVan(gezin.householdId)).filter((m) => m.type === "reminder")).toEqual([]);

    expect((await als(gezin.leden.Lynn.userId, () => setTaskStatusAction(uit.id, "todo"))).ok).toBe(true);
    na = await afvaltaken(gezin.householdId);
    expect(na.find((t) => t.id === uit.id)?.status).toBe("todo");
    expect(na.find((t) => t.id === binnen.id)?.status).toBe("todo");

    // Alleen binnenzetten overslaan laat buitenzetten ongemoeid
    expect((await als(gezin.leden.Lynn.userId, () => setTaskStatusAction(binnen.id, "skipped"))).ok).toBe(true);
    na = await afvaltaken(gezin.householdId);
    expect(na.find((t) => t.id === uit.id)?.status).toBe("todo");
  });
});

// =============================================================================
// AC-210 — vanzelf vervallen
// =============================================================================
describe("AC-210: verlopen en vanzelf vervallen", () => {
  it("di 07:46 niets; wo: buiten overgeslagen; do (dag van de volgende buitenzet-taak): binnen overgeslagen", async () => {
    const gezin = await maakGezin("Vervallen", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    zetBron({ rest: ["2026-10-06", "2026-10-09"] });
    await zetAan(gezin, "Jurgen", om("2026-10-05", "06:05"), { rest: ["2026-10-06", "2026-10-09"] });
    const status = async () => Object.fromEntries((await afvaltaken(gezin.householdId)).map((t) => [sleutel(t), t.status]));

    expect((await tick(om("2026-10-06", "07:46"))).expired).toBe(0);
    expect(await status()).toMatchObject({ "2026-10-06|out": "todo", "2026-10-06|in": "todo" });
    expect((await tick(om("2026-10-07", "00:05"))).expired).toBe(1);
    expect(await status()).toMatchObject({ "2026-10-06|out": "skipped", "2026-10-06|in": "todo", "2026-10-09|out": "todo" });
    expect((await tick(om("2026-10-08", "00:05"))).expired).toBe(1);
    expect(await status()).toMatchObject({ "2026-10-06|in": "skipped", "2026-10-09|out": "todo", "2026-10-09|in": "todo" });
    expect(await afvinkingen(gezin.householdId)).toEqual([]);
  });

  it("lange pauze zonder volgende buitenzet-taak: binnenzetten vervalt pas op D+7", async () => {
    const gezin = await maakGezin("Pauze", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    zetBron({ papier: ["2026-10-06", "2026-11-03"] });
    await zetAan(gezin, "Jurgen", om("2026-10-05", "06:05"), { papier: ["2026-10-06", "2026-11-03"] });
    await tick(om("2026-10-07", "06:10"));
    expect((await tick(om("2026-10-12", "23:50"))).expired).toBe(0);
    expect((await afvaltaken(gezin.householdId)).find((t) => sleutel(t) === "2026-10-06|in")?.status).toBe("todo");
    expect((await tick(om("2026-10-13", "00:05"))).expired).toBe(1);
    expect((await afvaltaken(gezin.householdId)).find((t) => sleutel(t) === "2026-10-06|in")?.status).toBe("skipped");
  });
});

// =============================================================================
// AC-194, AC-195, AC-211 — herinneringen via de echte tick
// =============================================================================
describe("AC-194/AC-195/AC-211: herinneringen", () => {
  it("21:00 en 18:00: Jurgen en Ellen elk één (M-01/M-02, meervoud bij twee bakken); Lynn en Kai niet; nooit 'deadline nadert' of 'verlopen'; Lynn aan → wel", async () => {
    const gezin = await maakGezin("Herinnering", [
      { naam: "Jurgen", rol: "admin", prefs: stil },
      { naam: "Ellen", rol: "admin", prefs: stil },
      { naam: "Lynn", rol: "member", prefs: stil },
      { naam: "Kai", rol: "member", actief: false, prefs: { ...stil, notify_reminders: true } },
    ]);
    zetBron({ rest: [d(1)], papier: [d(1)] });
    expect((await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).ok).toBe(true);
    const taken = await afvaltaken(gezin.householdId);
    expect(taken.map((t) => t.title)).toEqual(["Restafval en papier buitenzetten", "Restafval- en papierbak binnenzetten"]);
    const vanTaken = async () => (await meldingenVan(gezin.householdId)).filter((m) => /buitenzetten|binnenzetten/.test(m.title));

    await runTick(om(d(0), "21:03"));
    let m = await vanTaken();
    expect(m.map((x) => [x.member_id, x.type, x.title, x.body]).sort()).toEqual(
      [gezin.leden.Jurgen.memberId, gezin.leden.Ellen.memberId]
        .map((id) => [id, "reminder", "Herinnering: Restafval en papier buitenzetten", "Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45."])
        .sort(),
    );
    await runTick(om(d(0), "21:20"));
    expect(await vanTaken()).toHaveLength(2);

    // 's Nachts en na 07:45: geen deadline- of verlopen-melding voor afvaltaken
    for (const tijd of ["02:00", "07:50", "12:00"]) await runTick(om(d(1), tijd));
    expect((await vanTaken()).filter((x) => x.type !== "reminder")).toEqual([]);
    expect(await vanTaken()).toHaveLength(2);

    // Lynn zet herinneringen aan; om 18:00 krijgen Jurgen, Ellen én Lynn M-02 met meervoud
    must(await testDb().from("user_preferences").update({ notify_reminders: true }).eq("member_id", gezin.leden.Lynn.memberId).select("member_id"), "Lynn aan");
    await runTick(om(d(1), "18:04"));
    m = (await vanTaken()).filter((x) => x.title.includes("binnenzetten"));
    expect(m.map((x) => x.member_id).sort()).toEqual([gezin.leden.Jurgen.memberId, gezin.leden.Ellen.memberId, gezin.leden.Lynn.memberId].sort());
    expect(m.every((x) => x.body === "Vandaag was de ophaaldag. Zet de bakken vandaag nog binnen.")).toBe(true);
    expect((await meldingenVan(gezin.householdId)).filter((x) => x.member_id === gezin.leden.Kai.memberId)).toEqual([]);
  }, 90_000);

  it("AC-194 (a)/(b): een al afgevinkte taak krijgt geen herinnering", async () => {
    const gezin = await maakGezin("Gedaan", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    zetBron({ rest: [d(1)] });
    expect((await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).ok).toBe(true);
    const [uit, binnen] = await afvaltaken(gezin.householdId);
    expect((await als(gezin.leden.Jurgen.userId, () => completeTaskAction({ taskId: uit.id, mutationId: randomUUID() }))).ok).toBe(true);
    expect((await als(gezin.leden.Jurgen.userId, () => completeTaskAction({ taskId: binnen.id, mutationId: randomUUID() }))).ok).toBe(true);
    await runTick(om(d(0), "21:03"));
    await runTick(om(d(1), "18:03"));
    expect((await meldingenVan(gezin.householdId)).filter((m) => m.type === "reminder")).toEqual([]);
  });
});

// =============================================================================
// AC-213, AC-215 — uitzetten; handmatige taken ongemoeid
// =============================================================================
describe("AC-213/AC-215: uitzetten, en handmatige taken blijven", () => {
  it("uitzetten wist adres en open taken; gedaan blijft; daarna geen verzoek en geen taak meer; handmatige taak en reeks ongemoeid", async () => {
    const gezin = await maakGezin("Uit", [
      { naam: "Jurgen", rol: "admin", prefs: stil },
      { naam: "Lynn", rol: "member", prefs: stil },
    ]);
    const hand = must(await testDb().from("tasks").insert({ household_id: gezin.householdId, title: "Container schoonmaken", scheduled_date: d(2), created_by_member_id: gezin.leden.Jurgen.memberId }).select("id, title, scheduled_date").single(), "handmatig");
    const reeks = must(await testDb().from("task_recurrences").insert({ household_id: gezin.householdId, title: "Afvalcontainer buiten zetten", rule: { freq: "weekly", interval: 1, weekdays: [1] }, starts_on: d(0), created_by_member_id: gezin.leden.Jurgen.memberId }).select("id").single(), "reeks");
    zetBron({ rest: [d(2), d(9)] });
    expect((await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).ok).toBe(true);
    const [uit] = await afvaltaken(gezin.householdId);
    expect((await als(gezin.leden.Jurgen.userId, () => completeTaskAction({ taskId: uit.id, mutationId: randomUUID() }))).ok).toBe(true);
    await tick(NOW);

    const uitgezet = await als(gezin.leden.Jurgen.userId, () => disableWasteCalendarAction());
    expect(uitgezet).toEqual({ ok: true, data: { removed: 3 } });
    expect(await kalender(gezin.householdId)).toBeNull();
    const na = await afvaltaken(gezin.householdId);
    expect(na.map((t) => [t.id, t.status])).toEqual([[uit.id, "done"]]);
    expect(await afvinkingen(gezin.householdId)).toHaveLength(1);

    const b = zetBron({ rest: [d(2), d(9)] });
    const r = await tick(new Date(NOW.getTime() + 12 * 3_600_000));
    expect(r.fetched).toBe(0);
    expect(b.verzoeken).toHaveLength(0);
    expect(await afvaltaken(gezin.householdId)).toHaveLength(1);
    expect(await als(gezin.leden.Lynn.userId, () => getWasteSettingsAction())).toEqual({ ok: true, data: { role: "member", enabled: false, adminNames: ["Jurgen"] } });
    expect(await als(gezin.leden.Jurgen.userId, () => getWasteSettingsAction())).toEqual({ ok: true, data: { role: "admin", enabled: false } });
    expect(await als(gezin.leden.Jurgen.userId, () => disableWasteCalendarAction())).toEqual({ ok: true, data: { removed: 0 } });

    // AC-215
    expect(must(await testDb().from("tasks").select("id, title, scheduled_date, deleted_at").eq("id", hand.id).single(), "handmatig na")).toMatchObject({ ...hand, deleted_at: null });
    expect(must(await testDb().from("task_recurrences").select("is_active").eq("id", reeks.id).single(), "reeks na")).toMatchObject({ is_active: true });
  });
});

// =============================================================================
// AC-222 — hetzelfde adres opnieuw bevestigen
// =============================================================================
describe("AC-222: hetzelfde adres opnieuw bevestigen", () => {
  it("direct na een tick: 'unchanged', geen claim, notitie en 'bezig' blijven, geen dubbele taken; gewijzigde version → stale", async () => {
    const gezin = await maakGezin("Zelfde", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    zetBron({ rest: [d(3), d(10)] });
    expect((await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).ok).toBe(true);
    const [uit] = await afvaltaken(gezin.householdId);
    expect((await als(gezin.leden.Jurgen.userId, () => addCommentAction({ taskId: uit.id, body: "Let op de storm" }))).ok).toBe(true);
    expect((await als(gezin.leden.Jurgen.userId, () => setTaskStatusAction(uit.id, "in_progress"))).ok).toBe(true);
    await tick(new Date(NOW.getTime() - 30_000));
    const voor = await kalender(gezin.householdId);
    const takenVoor = await afvaltaken(gezin.householdId);

    const r = await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction({ postcode: "2511AB", houseNumber: "12", suffix: "" }));
    expect(r).toEqual({ ok: true, data: { kind: "saved", mode: "unchanged", inserted: 0, removed: 0 } });
    const na = await kalender(gezin.householdId);
    expect(na).toMatchObject({ version: voor!.version, last_attempt_at: voor!.last_attempt_at, bag_id: BAG });
    expect(await afvaltaken(gezin.householdId)).toEqual(takenVoor);
    expect(must(await testDb().from("task_comments").select("id").eq("task_id", uit.id), "notitie")).toHaveLength(1);

    // Een andere beheerder bevestigde intussen een ander adres (version gewijzigd) → stale, niets gedaan
    await zetKalender(gezin.householdId, { version: voor!.version + 1 });
    const stale = await applyConfirmedSameAddress(gezin.householdId, gezin.leden.Jurgen.memberId, voor!.version, { rest: [d(4)], papier: [], pmd: [] }, NOW);
    expect(stale).toMatchObject({ stale: true, inserted: 0, removed: 0 });
    expect(await afvaltaken(gezin.householdId)).toEqual(takenVoor);
  });
});

// =============================================================================
// AC-236 — "Opnieuw proberen"
// =============================================================================
describe('AC-236: "Opnieuw proberen"', () => {
  async function metStoring(label: string) {
    const gezin = await maakGezin(label, [
      { naam: "Jurgen", rol: "admin", prefs: stil },
      { naam: "Lynn", rol: "member", prefs: stil },
    ]);
    zetBron({ rest: [d(3)] });
    expect((await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).ok).toBe(true);
    // Al 49 uur niet gelukt (H1), nog geen alarm en geen claim
    await zetKalender(gezin.householdId, { last_success_at: new Date(NOW.getTime() - 49 * 3_600_000).toISOString(), last_attempt_at: null });
    return gezin;
  }

  it("(a) lukt: done, state ok, de balk weg, precies één ophaling; de opzoeklimiet telt niet mee", async () => {
    const gezin = await metStoring("RetryOk");
    const b = zetBron({ rest: [d(3), d(9)] });
    const r = await als(gezin.leden.Jurgen.userId, () => retryWasteSyncAction());
    expect(r.ok && r.data).toMatchObject({ kind: "done", health: { state: "ok", lastErrorCode: null } });
    expect(b.teller("afvalstromen")).toBe(1);
    expect((await afvaltaken(gezin.householdId)).map(sleutel)).toEqual([`${d(3)}|out`, `${d(3)}|in`, `${d(9)}|out`, `${d(9)}|in`]);
    expect(await meldingenVan(gezin.householdId)).toEqual([]);
    expect(must(await testDb().from("waste_lookup_windows").select("lookups").eq("household_id", gezin.householdId), "venster")).toEqual([{ lookups: 1 }]);
  });

  it("(b) lukt niet: done met state failed en attemptedAt; het alarm wordt vastgelegd en er gaat één M-03 uit; (c) binnen 60 s: too_soon zonder verzoek", async () => {
    const gezin = await metStoring("RetryFout");
    const b = zetBron({}, { alles: { body: "storing", status: 503 } });
    const r = await als(gezin.leden.Jurgen.userId, () => retryWasteSyncAction());
    expect(r.ok && r.data).toMatchObject({ kind: "done", health: { state: "failed", variant: "H1", lastErrorCode: "UNREACHABLE" } });
    expect(r.ok && r.data.kind === "done" && Math.abs(new Date(r.data.attemptedAt).getTime() - Date.now())).toBeLessThan(60_000);
    const cal = await kalender(gezin.householdId);
    expect(cal?.alarm_since).not.toBeNull();
    expect(cal?.last_error_code).toBe("UNREACHABLE");
    const meldingen = await meldingenVan(gezin.householdId);
    expect(meldingen.map((m) => [m.member_id, m.type])).toEqual([[gezin.leden.Jurgen.memberId, "waste_sync_failed"]]);

    const teller = b.verzoeken.length;
    expect(await als(gezin.leden.Jurgen.userId, () => retryWasteSyncAction())).toEqual({ ok: true, data: { kind: "too_soon" } });
    expect(b.verzoeken.length).toBe(teller);
    expect(await meldingenVan(gezin.householdId)).toHaveLength(1);
  });
});

// =============================================================================
// D-049 — grens op het opzoeken
// =============================================================================
describe("D-049: hooguit 20 opzoekingen per huishouden per uur", () => {
  it("de 21e opzoeking geeft 'unreachable' zonder verzoek naar de gemeente; bevestigen telt ook mee", async () => {
    const gezin = await maakGezin("Limiet", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    expect(WASTE_LOOKUP_LIMIT_PER_HOUR).toBe(20);
    for (let i = 0; i < 20; i++) expect(await allowWasteLookup(gezin.householdId, NOW)).toBe(true);
    expect(await allowWasteLookup(gezin.householdId, NOW)).toBe(false);
    expect(await allowWasteLookup(gezin.householdId, new Date(NOW.getTime() + 61 * 60_000))).toBe(true);

    // Vol venster: de action doet geen verzoek meer
    must(await testDb().from("waste_lookup_windows").update({ window_start: NOW.toISOString(), lookups: 20 }).eq("household_id", gezin.householdId).select("household_id"), "venster");
    const b = zetBron({ rest: [d(3)] });
    expect(await als(gezin.leden.Jurgen.userId, () => lookupWasteAddressAction(ADRES))).toEqual({ ok: true, data: { kind: "unreachable" } });
    expect(await als(gezin.leden.Jurgen.userId, () => confirmWasteAddressAction(ADRES))).toEqual({ ok: true, data: { kind: "unreachable" } });
    expect(b.verzoeken).toHaveLength(0);
    expect(await kalender(gezin.householdId)).toBeNull();
    expect(must(await testDb().from("waste_lookup_windows").select("lookups").eq("household_id", gezin.householdId), "venster").at(0)?.lookups).toBe(22);
  });
});
