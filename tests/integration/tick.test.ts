/**
 * WP3 — de tick als geheel, tegen de lokale teststack (TECHNICAL_DESIGN §11.3,
 * §13 "Integratie"; ACCEPTANCE_CRITERIA AC-064, AC-065, AC-071, AC-072, AC-074,
 * AC-075, AC-076).
 *
 * - Eén vaste `now` per scenario (vastgelegd bij het laden); alle testdata ligt
 *   relatief daaraan, zodat de uitkomst niet van het tijdstip van draaien afhangt.
 *   Het moment ligt dicht bij de echte klok: de tick werkt over alle huishoudens
 *   in de testdatabase en doet daar dan precies wat de echte planner nu ook zou
 *   doen (geen verschoven planning voor de E2E-gegevens).
 * - web-push is gemockt: er gaat niets naar een echte pushdienst. Het gedrag per
 *   abonnement volgt uit het endpoint (…/ok, …/weg-410, …/weg-404, …/fout-500).
 * - Asserties alleen op de eigen huishoudens en eigen endpoints.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const push = vi.hoisted(() => ({
  sends: [] as { endpoint: string; payload: string; options: Record<string, unknown> }[],
  /** Wordt aangeroepen bij elke verzending (bijv. om de klok vooruit te zetten) */
  onSend: null as null | ((endpoint: string) => void),
}));

vi.mock("web-push", () => {
  const api = {
    setVapidDetails: () => undefined,
    sendNotification: async (sub: { endpoint: string }, payload: string, options: Record<string, unknown>) => {
      push.sends.push({ endpoint: sub.endpoint, payload, options });
      push.onSend?.(sub.endpoint);
      const status = /fout-(\d{3})|weg-(\d{3})/.exec(sub.endpoint);
      if (status) throw Object.assign(new Error("push mislukt"), { statusCode: Number(status[1] ?? status[2]) });
      return { statusCode: 201 };
    },
  };
  return { default: api, ...api };
});

// Storingen per stap simuleren: de systeemclient is echt, behalve voor de
// tabellen/RPC's in `faults` (die geven een databasefout met een naam erin).
const faults = vi.hoisted(() => ({ tables: new Set<string>(), rpcs: new Set<string>() }));
vi.mock("@/server/system/admin-client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const fout = { data: null, error: { code: "XX001", message: "interne fout bij Jurgen", details: "taak Geheime titel" } };
  const failing = (): unknown => {
    const chain: unknown = new Proxy(function () {}, {
      get: (_t, prop) => (prop === "then" ? (ok: (v: unknown) => unknown, nok: (e: unknown) => unknown) => Promise.resolve(fout).then(ok, nok) : () => chain),
      apply: () => chain,
    });
    return chain;
  };
  const createAdminClient = () => {
    const real = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return new Proxy(real, {
      get(target, prop, receiver) {
        if (prop === "from") return (table: string) => (faults.tables.has(table) ? failing() : target.from(table));
        if (prop === "rpc") return (fn: string, ...rest: unknown[]) => (faults.rpcs.has(fn) ? failing() : (target.rpc as (...a: unknown[]) => unknown)(fn, ...rest));
        return Reflect.get(target, prop, receiver);
      },
    });
  };
  return { createAdminClient, hasAdminClient: () => true };
});

import { notify } from "@/server/system/dispatcher";
import { runTick, type TickReport } from "@/server/system/tick";
import { klokVan, maakGezin, meldingenVan, minuten, must, ruimOp, takenVan, testDb, vandaag, TZ } from "./support/fixtures";
import { zonedInstant } from "@/domain/dates";

const NOW = new Date();
const TODAY = vandaag(NOW);
const RUN = Math.random().toString(36).slice(2, 8);

function sendsTo(endpoint: string) {
  return push.sends.filter((s) => s.endpoint === endpoint).length;
}

async function abonneer(userId: string, soort: string) {
  const endpoint = `https://push.example.test/${RUN}/${soort}/${userId}`;
  must(
    await testDb().from("push_subscriptions").insert({ user_id: userId, endpoint, p256dh: "p256dh-test", auth: "auth-test" }).select("id").single(),
    "abonnement",
  );
  return endpoint;
}

async function abonnementen(userId: string) {
  return must(await testDb().from("push_subscriptions").select("endpoint").eq("user_id", userId), "abonnementen").map((s) => s.endpoint);
}

async function losseTaak(householdId: string, title: string, velden: Record<string, unknown>) {
  return must(
    await testDb()
      .from("tasks")
      .insert({ household_id: householdId, title, scheduled_date: TODAY, ...velden })
      .select("id")
      .single(),
    `taak ${title}`,
  );
}

async function dagelijkseReeks(householdId: string, title: string, velden: Record<string, unknown> = {}) {
  return must(
    await testDb()
      .from("task_recurrences")
      .insert({ household_id: householdId, title, rule: { freq: "daily", interval: 1 }, starts_on: vandaag(NOW, -3), ...velden })
      .select("id")
      .single(),
    `reeks ${title}`,
  );
}

/** Overzichten uit, zodat het tijdstip van draaien geen extra meldingen geeft */
const stil = { daily_summary_enabled: false, evening_summary_enabled: false };
const pushAan = { push_enabled: true, ...stil };

beforeEach(() => {
  push.sends.length = 0;
  push.onSend = null;
  faults.tables.clear();
  faults.rpcs.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await ruimOp();
});

// =============================================================================
// AC-065 — Een tweede tick maakt niets dubbel
// =============================================================================
describe("AC-065: een tweede tick maakt niets dubbel", () => {
  it("tweede tick op dezelfde now: geen extra taken, meldingen of pushes", async () => {
    const gezin = await maakGezin("Idem", [{ naam: "Jurgen", rol: "admin", prefs: pushAan }]);
    const { userId } = gezin.leden.Jurgen;
    const endpoint = await abonneer(userId, "ok");
    await dagelijkseReeks(gezin.householdId, "Idem vaatwasser");
    // herinnering 90 min vóór de deadline (nu − 30 min) en "deadline nadert" (over 60 min)
    await losseTaak(gezin.householdId, "Idem planten", { due_at: minuten(NOW, 60), reminder_minutes_before: [90] });

    const eerste = await runTick(NOW);
    expect(eerste.failed).toEqual([]);
    const takenNa1 = await takenVan(gezin.householdId);
    const meldingenNa1 = await meldingenVan(gezin.householdId);
    const pushesNa1 = sendsTo(endpoint);
    expect(takenNa1.filter((t) => t.recurrence_id)).toHaveLength(15); // vandaag t/m vandaag + 14
    expect(meldingenNa1.map((m) => m.type).sort()).toEqual(["deadline_soon", "reminder"]);
    expect(pushesNa1).toBe(2);

    await runTick(NOW);
    expect((await takenVan(gezin.householdId)).length).toBe(takenNa1.length);
    const meldingenNa2 = await meldingenVan(gezin.householdId);
    expect(meldingenNa2.map((m) => m.id).sort()).toEqual(meldingenNa1.map((m) => m.id).sort());
    expect(sendsTo(endpoint)).toBe(pushesNa1);
    // pushed_at is bij de tweede tick niet opnieuw gezet
    expect(meldingenNa2.map((m) => m.pushed_at).sort()).toEqual(meldingenNa1.map((m) => m.pushed_at).sort());
  });

  it("twee overlappende ticks: samen precies één keer plannen, melden en pushen", async () => {
    const gezin = await maakGezin("Overlap", [{ naam: "Jurgen", rol: "admin", prefs: pushAan }]);
    const endpoint = await abonneer(gezin.leden.Jurgen.userId, "ok");
    await dagelijkseReeks(gezin.householdId, "Overlap afwas");
    await losseTaak(gezin.householdId, "Overlap planten", { due_at: minuten(NOW, 60), reminder_minutes_before: [90] });

    const [a, b] = await Promise.all([runTick(NOW), runTick(NOW)]);
    expect([...a.failed, ...b.failed]).toEqual([]);

    const taken = (await takenVan(gezin.householdId)).filter((t) => t.recurrence_id);
    expect(taken).toHaveLength(15);
    expect(new Set(taken.map((t) => t.occurrence_date)).size).toBe(15);
    const meldingen = await meldingenVan(gezin.householdId);
    expect(meldingen.map((m) => m.type).sort()).toEqual(["deadline_soon", "reminder"]);
    expect(sendsTo(endpoint)).toBe(2);
  });
});

// =============================================================================
// AC-064 (Int-deel) en AC-071 — wie krijgt welke melding; AC-074 geen namen
// =============================================================================
describe("AC-071/AC-064: ontvangers van herinnering, deadline, verlopen en overzicht", () => {
  it("alleen de beheerder (standaard) en het lid dat het zelf aanzette; Lynn (standaard) en Kai (uitgezet) niets", async () => {
    const klok = klokVan(NOW);
    const allesAan = {
      notify_reminders: true,
      notify_deadline_soon: true,
      notify_overdue: true,
      daily_summary_enabled: true,
      evening_summary_enabled: true,
    };
    const tijden = { daily_summary_time: klok, evening_summary_time: klok };
    const gezin = await maakGezin("Ontvangers", [
      { naam: "Jurgen", rol: "admin", prefs: tijden },
      { naam: "Lynn", rol: "member", prefs: tijden },
      { naam: "Kai", rol: "member", actief: false, prefs: { ...allesAan, ...tijden } },
      { naam: "Noor", rol: "member", prefs: { ...allesAan, ...tijden } },
    ]);
    // herinnering (T = nu − 20 min; AC-064: bij de eerste tick na T bestaat de melding)
    await losseTaak(gezin.householdId, "Ontv ramen", { due_at: minuten(NOW, 180), reminder_minutes_before: [200] });
    await losseTaak(gezin.householdId, "Ontv stofzuigen", { due_at: minuten(NOW, 60) }); // deadline nadert
    await losseTaak(gezin.householdId, "Ontv container", { due_at: minuten(NOW, -30) }); // verlopen

    const report = await runTick(NOW);
    expect(report.failed).toEqual([]);
    const meldingen = await meldingenVan(gezin.householdId);
    const typesVan = (naam: string) =>
      meldingen.filter((m) => m.member_id === gezin.leden[naam].memberId).map((m) => m.type).sort();

    const verwacht = ["daily_summary", "deadline_soon", "evening_summary", "overdue", "reminder"];
    expect(typesVan("Jurgen")).toEqual(verwacht);
    expect(typesVan("Noor")).toEqual(verwacht);
    expect(typesVan("Lynn")).toEqual([]);
    expect(typesVan("Kai")).toEqual([]);

    // AC-064: de herinnering is er na de tick (uiterlijk T + 15 min, de volgende tick)
    const herinnering = meldingen.find((m) => m.type === "reminder" && m.member_id === gezin.leden.Jurgen.memberId)!;
    expect(herinnering.title).toBe("Herinnering: Ontv ramen");

    // AC-074 / AC-072: geen naam van een lid en geen "voor jou" in titel of tekst
    for (const m of meldingen) {
      const tekst = `${m.title} ${m.body ?? ""}`;
      for (const naam of ["Jurgen", "Lynn", "Kai", "Noor"]) expect(tekst).not.toContain(naam);
      expect(tekst.toLowerCase()).not.toMatch(/\bjou\b|\bjouw\b|\bjij\b/);
    }
  });
});

// =============================================================================
// AC-072 — dag- en avondoverzicht voor het huishouden
// =============================================================================
describe("AC-072: dag- en avondoverzicht", () => {
  it("5 open taken vandaag en 1 verlopen: één keer 'Vandaag staan er 5 taken' en één keer 'Er staan nog 6 taken open'", async () => {
    const klok = klokVan(NOW);
    const gezin = await maakGezin("Overzicht", [
      { naam: "Ellen", rol: "admin", prefs: { daily_summary_time: klok, evening_summary_time: klok, notify_overdue: false } },
    ]);
    for (let i = 1; i <= 5; i++) await losseTaak(gezin.householdId, `Overz vandaag ${i}`, {});
    const gisteren = vandaag(NOW, -1);
    await losseTaak(gezin.householdId, "Overz verlopen", { scheduled_date: gisteren, due_at: zonedInstant(gisteren, "12:00", TZ) });
    // telt niet mee: morgen, al gedaan (via overgeslagen), verwijderd
    await losseTaak(gezin.householdId, "Overz morgen", { scheduled_date: vandaag(NOW, 1) });
    await losseTaak(gezin.householdId, "Overz overgeslagen", { status: "skipped" });
    await losseTaak(gezin.householdId, "Overz verwijderd", { deleted_at: minuten(NOW, -5) });

    await runTick(NOW);
    await runTick(NOW); // tweede keer in hetzelfde venster: niet opnieuw
    const overzichten = (await meldingenVan(gezin.householdId)).filter((m) => m.type.endsWith("_summary"));
    expect(overzichten.map((m) => `${m.type}: ${m.title}`).sort()).toEqual([
      "daily_summary: Vandaag staan er 5 taken",
      "evening_summary: Er staan nog 6 taken open",
    ]);
  });

  it("bij 0 open taken komt er geen overzicht", async () => {
    const klok = klokVan(NOW);
    const gezin = await maakGezin("Leeg", [{ naam: "Ellen", rol: "admin", prefs: { daily_summary_time: klok, evening_summary_time: klok } }]);
    await losseTaak(gezin.householdId, "Leeg morgen", { scheduled_date: vandaag(NOW, 1) });
    await runTick(NOW);
    expect(await meldingenVan(gezin.householdId)).toEqual([]);
  });
});

// =============================================================================
// AC-075 — pushen alleen voor nieuwe meldingen, pushed_at per id, dode abonnementen weg
// =============================================================================
describe("AC-075: push alleen voor nieuwe meldingen", () => {
  it("tick: bestaande melding niet opnieuw gepusht; oudere melding met dezelfde titel ongemoeid; 404/410 weg, 500 blijft", async () => {
    const gezin = await maakGezin("Push", [{ naam: "Jurgen", rol: "admin", prefs: pushAan }]);
    const { userId, memberId } = gezin.leden.Jurgen;
    const ok = await abonneer(userId, "ok");
    const weg410 = await abonneer(userId, "weg-410");
    const weg404 = await abonneer(userId, "weg-404");
    const fout500 = await abonneer(userId, "fout-500");
    const taak = await losseTaak(gezin.householdId, "Push ramen", { due_at: minuten(NOW, 180), reminder_minutes_before: [200] });
    // Oudere melding met precies dezelfde titel (vorige keer), nooit gepusht
    const oud = must(
      await testDb()
        .from("notifications")
        .insert({
          household_id: gezin.householdId,
          member_id: memberId,
          type: "reminder",
          title: "Herinnering: Push ramen",
          task_id: taak.id,
          dedupe_key: `reminder:oud:${RUN}`,
          created_at: minuten(NOW, -2 * 24 * 60),
        })
        .select("id")
        .single(),
      "oude melding",
    );

    await runTick(NOW);
    const na1 = await meldingenVan(gezin.householdId);
    const nieuw = na1.filter((m) => m.id !== oud.id);
    expect(nieuw).toHaveLength(1);
    expect(nieuw[0].pushed_at).not.toBeNull();
    expect(na1.find((m) => m.id === oud.id)!.pushed_at).toBeNull(); // pushed_at op id, niet op titel
    expect([ok, weg410, weg404, fout500].map(sendsTo)).toEqual([1, 1, 1, 1]);
    expect((await abonnementen(userId)).sort()).toEqual([fout500, ok].sort());
    expect(JSON.parse(push.sends.find((s) => s.endpoint === ok)!.payload)).toMatchObject({ title: "Herinnering: Push ramen" });

    await runTick(NOW);
    expect(sendsTo(ok)).toBe(1);
    expect(sendsTo(fout500)).toBe(1);
    const na2 = await meldingenVan(gezin.householdId);
    expect(na2.find((m) => m.id === nieuw[0].id)!.pushed_at).toBe(nieuw[0].pushed_at);
    expect(na2.find((m) => m.id === oud.id)!.pushed_at).toBeNull();
  });

  it("dispatcher (notify): pushed_at alleen op de nieuwe melding; dezelfde dedupe-sleutel wordt niet opnieuw gepusht", async () => {
    const gezin = await maakGezin("Notify", [{ naam: "Jurgen", rol: "admin", prefs: { ...pushAan, notify_task_completed: true } }]);
    const { userId, memberId } = gezin.leden.Jurgen;
    const ok = await abonneer(userId, "ok");
    const oud = must(
      await testDb()
        .from("notifications")
        .insert({ household_id: gezin.householdId, member_id: memberId, type: "task_completed", title: "Afwas is gedaan", dedupe_key: `done:oud:${RUN}` })
        .select("id")
        .single(),
      "oude melding",
    );

    const message = { type: "task_completed" as const, title: "Afwas is gedaan", dedupeKey: `done:nieuw:${RUN}` };
    await notify({ householdId: gezin.householdId, message });
    await notify({ householdId: gezin.householdId, message });

    const meldingen = await meldingenVan(gezin.householdId);
    expect(meldingen).toHaveLength(2);
    expect(meldingen.find((m) => m.id === oud.id)!.pushed_at).toBeNull();
    expect(meldingen.find((m) => m.id !== oud.id)!.pushed_at).not.toBeNull();
    expect(sendsTo(ok)).toBe(1);
  });
});

// =============================================================================
// AC-076 — een fout in één stap blokkeert de andere niet
// =============================================================================
describe("AC-076: een fout in één stap blokkeert de andere niet", () => {
  function vangLog() {
    const regels: string[] = [];
    for (const level of ["error", "info", "log", "warn"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        regels.push(args.map(String).join(" "));
      });
    }
    return regels;
  }

  function alleenTellingenEnCodes(report: TickReport) {
    expect(Object.keys(report).sort()).toEqual(["failed", "households", "notified", "planned", "purged", "pushed", "skipped"]);
    for (const key of ["households", "notified", "planned", "pushed", "skipped"] as const) expect(typeof report[key]).toBe("number");
    for (const value of Object.values(report.purged ?? {})) expect(typeof value).toBe("number");
    for (const code of report.failed) expect(["plannen", "overslaan", "meldingen", "opruimen"]).toContain(code);
  }

  it("meldingenstap faalt: plannen en opruimen draaien toch; antwoord en log bevatten alleen tellingen en codes", async () => {
    const gezin = await maakGezin("StoringMeld", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    await dagelijkseReeks(gezin.householdId, "Storing geheime reeks");
    await losseTaak(gezin.householdId, "Storing geheime taak", { due_at: minuten(NOW, 60) });
    const oud = must(
      await testDb()
        .from("notifications")
        .insert({
          household_id: gezin.householdId,
          member_id: gezin.leden.Jurgen.memberId,
          type: "reminder",
          title: "Storing oude melding",
          created_at: new Date(Date.now() - 91 * 86_400_000).toISOString(),
        })
        .select("id")
        .single(),
      "oude melding",
    );
    faults.tables.add("user_preferences");
    const log = vangLog();

    const report = await runTick(NOW);

    expect(report.failed).toEqual(["meldingen"]);
    expect((await takenVan(gezin.householdId)).filter((t) => t.recurrence_id)).toHaveLength(15); // plannen draaide
    expect(report.purged).not.toBeNull(); // opruimen draaide
    const meldingen = await meldingenVan(gezin.householdId);
    expect(meldingen.find((m) => m.id === oud.id)).toBeUndefined(); // > 90 dagen: opgeruimd
    expect(meldingen).toHaveLength(0); // de meldingenstap schreef niets

    alleenTellingenEnCodes(report);
    const alles = `${JSON.stringify(report)}\n${log.join("\n")}`;
    for (const verboden of ["Jurgen", "Geheime titel", "interne fout", "Storing geheime", "example.com"]) expect(alles).not.toContain(verboden);
    expect(log.some((r) => r.includes("meldingen") && r.includes("XX001"))).toBe(true);
  });

  it("planningsstap faalt: overslaan, meldingen en opruimen draaien toch", async () => {
    const gezin = await maakGezin("StoringPlan", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    await dagelijkseReeks(gezin.householdId, "Storing plan reeks");
    await losseTaak(gezin.householdId, "Storing plan taak", { due_at: minuten(NOW, 60) });
    faults.tables.add("task_recurrences");
    vangLog();

    const report = await runTick(NOW);

    expect(report.failed).toEqual(["plannen"]);
    expect((await takenVan(gezin.householdId)).filter((t) => t.recurrence_id)).toHaveLength(0);
    expect((await meldingenVan(gezin.householdId)).map((m) => m.type)).toEqual(["deadline_soon"]);
    expect(report.purged).not.toBeNull();
    alleenTellingenEnCodes(report);
  });

  it("opruimstap faalt: de rest van de tick is al gedaan en het antwoord noemt alleen de code", async () => {
    const gezin = await maakGezin("StoringOpruim", [{ naam: "Jurgen", rol: "admin", prefs: stil }]);
    await losseTaak(gezin.householdId, "Storing opruim taak", { due_at: minuten(NOW, 60) });
    faults.rpcs.add("run_purge");
    vangLog();

    const report = await runTick(NOW);

    expect(report.failed).toEqual(["opruimen"]);
    expect(report.purged).toBeNull();
    expect((await meldingenVan(gezin.householdId)).map((m) => m.type)).toEqual(["deadline_soon"]);
    alleenTellingenEnCodes(report);
  });

  it("na het pushbudget van 45 s geen nieuwe pushes; de meldingen staan wel in de app en worden later niet alsnog gepusht", async () => {
    const gezin = await maakGezin("Budget", [{ naam: "Jurgen", rol: "admin", prefs: pushAan }]);
    const endpoint = await abonneer(gezin.leden.Jurgen.userId, "ok");
    for (const naam of ["een", "twee", "drie"]) {
      await losseTaak(gezin.householdId, `Budget ${naam}`, { due_at: minuten(NOW, 180), reminder_minutes_before: [200] });
    }
    // De eerste push naar dit toestel "duurt" 46 s: daarna is het budget op
    let extra = 0;
    const echt = Date.now.bind(Date);
    vi.spyOn(Date, "now").mockImplementation(() => echt() + extra);
    push.onSend = (e) => {
      if (e === endpoint) extra += 46_000;
    };

    await runTick(NOW);

    const meldingen = await meldingenVan(gezin.householdId);
    expect(meldingen).toHaveLength(3); // alle drie in de app
    expect(sendsTo(endpoint)).toBe(1); // na het budget geen nieuwe pushes
    expect(meldingen.filter((m) => m.pushed_at !== null)).toHaveLength(1);

    // Bewuste beperking (§11.3): de volgende run pusht niet opnieuw (dedupe)
    push.onSend = null;
    await runTick(NOW);
    expect(sendsTo(endpoint)).toBe(1);
    expect(await meldingenVan(gezin.householdId)).toHaveLength(3);
  });
});
