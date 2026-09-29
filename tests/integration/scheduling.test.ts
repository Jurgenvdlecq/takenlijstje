/**
 * WP3 — set-gebaseerd plannen en overslaan over meerdere huishoudens tegelijk
 * (TECHNICAL_DESIGN §11.3 stap 1 en 2; ACCEPTANCE_CRITERIA AC-066, AC-067, AC-068).
 * planAllSeries en skipAllSuperseded werken over álle huishoudens; de asserties
 * gaan alleen over de eigen huishoudens. Vaste `now` (vastgelegd bij het laden).
 */
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { addDays, isoWeekday, zonedInstant } from "@/domain/dates";
import type { DbClient } from "@/lib/supabase/server";
import { planAllSeries, skipAllSuperseded, topUpSeries } from "@/server/services/scheduling";
import { maakGezin, must, ruimOp, takenVan, testDb, vandaag, TZ } from "./support/fixtures";

const NOW = new Date();
const TODAY = vandaag(NOW);
const db = () => testDb() as unknown as DbClient;

async function reeks(householdId: string, title: string, velden: Record<string, unknown>) {
  return must(
    await testDb()
      .from("task_recurrences")
      .insert({ household_id: householdId, title, starts_on: addDays(TODAY, -30), ...velden })
      .select("id")
      .single(),
    `reeks ${title}`,
  );
}

function datumsVan(taken: { recurrence_id: string | null; occurrence_date: string | null }[], reeksId: string) {
  return taken.filter((t) => t.recurrence_id === reeksId).map((t) => t.occurrence_date!).sort();
}

afterAll(async () => {
  await ruimOp();
});

describe("AC-066: planning 14 dagen vooruit, over meerdere huishoudens in één keer", () => {
  it("wekelijks: alle uitvoeringen tot 14 dagen vooruit; maandelijks: alleen de eerstvolgende; nooit dubbel", async () => {
    const a = await maakGezin("PlanA", [{ naam: "Jurgen", rol: "admin" }]);
    const b = await maakGezin("PlanB", [{ naam: "Ellen", rol: "admin" }]);
    const wekelijks = await reeks(a.householdId, "Plan wekelijks", { rule: { freq: "weekly", interval: 1, weekdays: [isoWeekday(TODAY)] } });
    const maandelijks = await reeks(b.householdId, "Plan maandelijks", { rule: { freq: "monthly", interval: 1, monthDay: 1 } });

    await planAllSeries(db(), NOW);

    expect(datumsVan(await takenVan(a.householdId), wekelijks.id)).toEqual([TODAY, addDays(TODAY, 7), addDays(TODAY, 14)]);
    const maand = datumsVan(await takenVan(b.householdId), maandelijks.id);
    expect(maand).toHaveLength(1);
    expect(maand[0] >= TODAY).toBe(true);
    expect(maand[0].endsWith("-01")).toBe(true);
    const horizon = must(await testDb().from("task_recurrences").select("generated_until").eq("id", wekelijks.id).single(), "reeks");
    expect(horizon.generated_until).toBe(addDays(TODAY, 14));

    // Tweede keer plannen: niets dubbel, ook niet voor de maandelijkse
    await planAllSeries(db(), NOW);
    const takenA = await takenVan(a.householdId);
    const takenB = await takenVan(b.householdId);
    expect(datumsVan(takenA, wekelijks.id)).toEqual([TODAY, addDays(TODAY, 7), addDays(TODAY, 14)]);
    expect(datumsVan(takenB, maandelijks.id)).toEqual(maand);
  });

  it("een bewust verwijderde uitvoering binnen de horizon komt niet terug", async () => {
    const c = await maakGezin("PlanC", [{ naam: "Jurgen", rol: "admin" }]);
    const dagelijks = await reeks(c.householdId, "Plan dagelijks", { rule: { freq: "daily", interval: 1 } });
    await planAllSeries(db(), NOW);
    const morgen = addDays(TODAY, 1);
    must(
      await testDb().from("tasks").update({ deleted_at: NOW.toISOString() }).eq("recurrence_id", dagelijks.id).eq("occurrence_date", morgen).select("id"),
      "verwijderen",
    );
    // Opnieuw plannen vanaf nul (generated_until leeg), zoals na hervatten
    must(await testDb().from("task_recurrences").update({ generated_until: null }).eq("id", dagelijks.id).select("id"), "horizon leeg");
    await planAllSeries(db(), NOW);
    const opMorgen = (await takenVan(c.householdId)).filter((t) => t.recurrence_id === dagelijks.id && t.occurrence_date === morgen);
    expect(opMorgen).toHaveLength(1);
    expect(opMorgen[0].deleted_at).not.toBeNull();
  });
});

describe("AC-067: pauze wordt gerespecteerd", () => {
  it("geen uitvoeringen in de pauze; daarna staan ze er weer zonder handeling", async () => {
    const p = await maakGezin("Pauze", [{ naam: "Jurgen", rol: "admin" }]);
    const van = addDays(TODAY, 3);
    const tot = addDays(TODAY, 6);
    const dagelijks = await reeks(p.householdId, "Pauze dagelijks", { rule: { freq: "daily", interval: 1 }, paused_from: van, paused_until: tot });

    await planAllSeries(db(), NOW);

    const datums = datumsVan(await takenVan(p.householdId), dagelijks.id);
    expect(datums.filter((d) => d >= van && d <= tot)).toEqual([]);
    expect(datums).toEqual([0, 1, 2, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => addDays(TODAY, n)));
  });
});

describe("AC-068: verlopen stapelt niet op (BR-16), over meerdere huishoudens", () => {
  async function metVerlopenGisteren(label: string) {
    const gezin = await maakGezin(label, [{ naam: "Jurgen", rol: "admin" }]);
    const dagelijks = await reeks(gezin.householdId, `${label} vaatwasser`, { rule: { freq: "daily", interval: 1 } });
    const gisteren = addDays(TODAY, -1);
    const oud = must(
      await testDb()
        .from("tasks")
        .insert({
          household_id: gezin.householdId,
          recurrence_id: dagelijks.id,
          occurrence_date: gisteren,
          title: `${label} vaatwasser`,
          scheduled_date: gisteren,
          available_from: zonedInstant(gisteren, "00:00", TZ),
          due_at: zonedInstant(gisteren, "23:59", TZ),
        })
        .select("id")
        .single(),
      "taak gisteren",
    );
    return { gezin, dagelijks, oud };
  }

  it("de uitvoering van gisteren wordt 'overgeslagen' zodra die van vandaag beschikbaar is, in elk huishouden", async () => {
    const x = await metVerlopenGisteren("SkipX");
    const y = await metVerlopenGisteren("SkipY");
    // Controle: een losse verlopen taak (geen reeks) blijft open
    const los = must(
      await testDb()
        .from("tasks")
        .insert({ household_id: x.gezin.householdId, title: "SkipX los", scheduled_date: addDays(TODAY, -1), due_at: zonedInstant(addDays(TODAY, -1), "12:00", TZ) })
        .select("id")
        .single(),
      "losse taak",
    );

    await planAllSeries(db(), NOW); // maakt die van vandaag aan
    await skipAllSuperseded(db(), NOW);

    for (const { gezin, oud, dagelijks } of [x, y]) {
      const taken = await takenVan(gezin.householdId);
      expect(taken.find((t) => t.id === oud.id)!.status).toBe("skipped");
      const vandaagTaak = taken.find((t) => t.recurrence_id === dagelijks.id && t.occurrence_date === TODAY)!;
      expect(vandaagTaak.status).toBe("todo");
    }
    expect((await takenVan(x.gezin.householdId)).find((t) => t.id === los.id)!.status).toBe("todo");

    // Tweede keer: niets meer te doen voor deze huishoudens
    await skipAllSuperseded(db(), NOW);
    const skipped = (await takenVan(x.gezin.householdId)).filter((t) => t.status === "skipped");
    expect(skipped.map((t) => t.id)).toEqual([x.oud.id]);
  });

  it("zonder nieuwere beschikbare uitvoering blijft de verlopen taak open", async () => {
    const gezin = await maakGezin("SkipZ", [{ naam: "Jurgen", rol: "admin" }]);
    const gestopt = await reeks(gezin.householdId, "SkipZ gestopt", { rule: { freq: "daily", interval: 1 }, is_active: false });
    const gisteren = addDays(TODAY, -1);
    const oud = must(
      await testDb()
        .from("tasks")
        .insert({
          household_id: gezin.householdId,
          recurrence_id: gestopt.id,
          occurrence_date: gisteren,
          title: "SkipZ gestopt",
          scheduled_date: gisteren,
          due_at: zonedInstant(gisteren, "23:59", TZ),
        })
        .select("id")
        .single(),
      "taak gisteren",
    );
    await planAllSeries(db(), NOW);
    await skipAllSuperseded(db(), NOW);
    expect((await takenVan(gezin.householdId)).find((t) => t.id === oud.id)!.status).toBe("todo");
  });
});

// =============================================================================
// Code-review WP3, doorgeven (a): planAllSeries plant hetzelfde als topUpSeries
// =============================================================================
describe("AC-066/AC-067: planAllSeries geeft dezelfde uitvoeringen als topUpSeries", () => {
  it("wekelijks, maandelijks, gepauzeerd, verwijderde uitvoering binnen de horizon en een reeks over middernacht", async () => {
    const perReeks = async (householdId: string) => {
      const specs: [string, Record<string, unknown>][] = [
        ["Gelijk wekelijks", { rule: { freq: "weekly", interval: 1, weekdays: [isoWeekday(TODAY), isoWeekday(addDays(TODAY, 3))] } }],
        ["Gelijk maandelijks", { rule: { freq: "monthly", interval: 1, monthDay: -1 } }],
        ["Gelijk gepauzeerd", { rule: { freq: "daily", interval: 1 }, paused_from: addDays(TODAY, 2), paused_until: addDays(TODAY, 9) }],
        ["Gelijk verwijderd", { rule: { freq: "daily", interval: 2 } }],
        [
          "Gelijk middernacht",
          { rule: { freq: "daily", interval: 1 }, time_of_day: "23:30", available_days_before: 1, due_days_after: 1, due_time: "00:30", reminder_minutes_before: [15] },
        ],
      ];
      const ids: Record<string, string> = {};
      for (const [title, velden] of specs) ids[title] = (await reeks(householdId, title, velden)).id;
      // Een bewust verwijderde uitvoering binnen de horizon (vandaag), vooraf in beide huishoudens
      must(
        await testDb()
          .from("tasks")
          .insert({
            household_id: householdId,
            recurrence_id: ids["Gelijk verwijderd"],
            occurrence_date: TODAY,
            title: "Gelijk verwijderd",
            scheduled_date: TODAY,
            deleted_at: NOW.toISOString(),
          })
          .select("id"),
        "verwijderde uitvoering",
      );
      return ids;
    };
    const een = await maakGezin("GelijkTopUp", [{ naam: "Jurgen", rol: "admin" }]);
    const twee = await maakGezin("GelijkAlles", [{ naam: "Jurgen", rol: "admin" }]);
    await perReeks(een.householdId);
    await perReeks(twee.householdId);

    await topUpSeries(db(), een.householdId, { now: NOW });
    await planAllSeries(db(), NOW);

    const beeld = async (householdId: string) =>
      must(
        await testDb()
          .from("tasks")
          .select("title, occurrence_date, scheduled_date, scheduled_time, available_from, due_at, reminder_minutes_before, status, deleted_at")
          .eq("household_id", householdId),
        "taken",
      )
        .map((t) => `${t.title}|${t.occurrence_date}|${t.scheduled_date}|${t.scheduled_time}|${t.available_from}|${t.due_at}|${t.reminder_minutes_before}|${t.status}|${t.deleted_at ? "verwijderd" : "-"}`)
        .sort();
    const viaTopUp = await beeld(een.householdId);
    const viaAlles = await beeld(twee.householdId);
    expect(viaAlles).toEqual(viaTopUp);
    expect(viaAlles.length).toBeGreaterThan(20);
    // Pauze en verwijderde uitvoering gerespecteerd in beide
    for (const rij of viaAlles) {
      const [title, datum] = rij.split("|");
      if (title === "Gelijk gepauzeerd") expect(datum < addDays(TODAY, 2) || datum > addDays(TODAY, 9)).toBe(true);
    }
    expect(viaAlles.filter((r) => r.startsWith(`Gelijk verwijderd|${TODAY}|`))).toHaveLength(1);

    const horizons = async (householdId: string) =>
      must(await testDb().from("task_recurrences").select("title, generated_until").eq("household_id", householdId), "reeksen")
        .map((r) => `${r.title}|${r.generated_until}`)
        .sort();
    expect(await horizons(twee.householdId)).toEqual(await horizons(een.householdId));
  });
});

// =============================================================================
// Code-review WP3, punt 1 (regressie): overslaan mag een net afgevinkte taak niet overschrijven
// =============================================================================
describe("BR-11/BR-16: een taak die tussen lezen en bijwerken wordt afgevinkt, blijft gedaan", () => {
  it("skipAllSuperseded zet een net afgevinkte taak niet op 'overgeslagen'", async () => {
    const gezin = await maakGezin("SkipRace", [{ naam: "Jurgen", rol: "admin" }]);
    const dagelijks = await reeks(gezin.householdId, "SkipRace vaatwasser", { rule: { freq: "daily", interval: 1 } });
    const gisteren = addDays(TODAY, -1);
    const oud = must(
      await testDb()
        .from("tasks")
        .insert({
          household_id: gezin.householdId,
          recurrence_id: dagelijks.id,
          occurrence_date: gisteren,
          title: "SkipRace vaatwasser",
          scheduled_date: gisteren,
          available_from: zonedInstant(gisteren, "00:00", TZ),
          due_at: zonedInstant(gisteren, "23:59", TZ),
        })
        .select("id")
        .single(),
      "taak gisteren",
    );
    await planAllSeries(db(), NOW);

    // Iemand vinkt de taak af precies nadat de tick de open taken heeft gelezen
    // (vlak vóór de update-query wordt uitgevoerd, hoe die keten er ook uitziet)
    let afgevinkt = false;
    const vinkAf = async () => {
      if (afgevinkt) return;
      afgevinkt = true;
      must(await testDb().from("tasks").update({ status: "done", completed_at: NOW.toISOString() }).eq("id", oud.id).select("id"), "afvinken");
    };
    type Keten = Record<string | symbol, unknown> & PromiseLike<unknown>;
    const metAfvinken = (keten: Keten): Keten =>
      new Proxy(keten, {
        get(k, p, r) {
          if (p === "then") return (ok: (v: unknown) => unknown, nok: (e: unknown) => unknown) => vinkAf().then(() => k.then(ok, nok));
          const v = Reflect.get(k, p, r);
          return typeof v === "function" ? (...a: unknown[]) => metAfvinken((v as (...x: unknown[]) => Keten).apply(k, a)) : v;
        },
      });
    const echt = db();
    const racend = new Proxy(echt, {
      get(target, prop, receiver) {
        if (prop !== "from") return Reflect.get(target, prop, receiver);
        return (table: string) => {
          const builder = target.from(table as never);
          if (table !== "tasks") return builder;
          return new Proxy(builder, {
            get(b, p, r) {
              if (p !== "update") return Reflect.get(b, p, r);
              return (...args: unknown[]) => metAfvinken((b.update as unknown as (...a: unknown[]) => Keten)(...args));
            },
          });
        };
      },
    }) as DbClient;

    await skipAllSuperseded(racend, NOW);

    expect(afgevinkt).toBe(true);
    const taak = must(await testDb().from("tasks").select("status, completed_at").eq("id", oud.id).single(), "taak");
    expect(taak.status).toBe("done");
  });
});
