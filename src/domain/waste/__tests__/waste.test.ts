/**
 * W-03 afvalkalender — pure domeinlogica (TECHNICAL_DESIGN §18.15, kolom Unit).
 * Alle tijden Europe/Amsterdam; "D" is de ophaaldag.
 */
import { describe, expect, it } from "vitest";
import { recipientsFor } from "../../reminders";
import { matchCandidate, normalizeWasteAddress, type AddressCandidate } from "../address";
import { findExpiredWasteTasks, type ExpiryWasteTask } from "../expire";
import { dueForFetch, wasteSyncHealth, type WasteSyncState } from "../health";
import { wasteFailureMessage, wasteReminder, type WasteReminderTask } from "../messages";
import { isSuspectEmpty, planWasteTasks, wasteTaskFields, wasteTitle, type ExistingWasteTask } from "../plan";
import { classifyStream } from "../streams";

const TZ = "Europe/Amsterdam";
const at = (iso: string) => new Date(iso);

describe("wasteTitle — exacte namen (UX_SPEC §13.3, AC-192, AC-193, AC-195)", () => {
  const cases: [string[], string, string][] = [
    [["rest"], "Restafval buitenzetten", "Restafvalbak binnenzetten"],
    [["papier"], "Papier buitenzetten", "Papierbak binnenzetten"],
    [["pmd"], "PMD buitenzetten", "PMD-bak binnenzetten"],
    [["rest", "papier"], "Restafval en papier buitenzetten", "Restafval- en papierbak binnenzetten"],
    [["rest", "pmd"], "Restafval en PMD buitenzetten", "Restafval- en PMD-bak binnenzetten"],
    [["papier", "pmd"], "Papier en PMD buitenzetten", "Papier- en PMD-bak binnenzetten"],
    [["rest", "papier", "pmd"], "Restafval, papier en PMD buitenzetten", "Restafval-, papier- en PMD-bak binnenzetten"],
  ];
  it.each(cases)("%j", (streams, out, inn) => {
    expect(wasteTitle(streams, "out")).toBe(out);
    expect(wasteTitle(streams, "in")).toBe(inn);
    expect(out.length).toBeLessThanOrEqual(47);
    expect(inn.length).toBeLessThanOrEqual(47);
  });
  it("de volgorde ligt vast, ook als de bron hem anders geeft", () => {
    expect(wasteTitle(["pmd", "rest", "papier", "rest"], "out")).toBe("Restafval, papier en PMD buitenzetten");
  });
});

describe("wasteTaskFields — tijden (AC-192, AC-193, AC-206)", () => {
  it("buitenzetten: D−1 21:00, deadline D 07:45, omschrijving", () => {
    const f = wasteTaskFields("2026-10-06", "out", ["rest"], TZ);
    expect(f).toMatchObject({
      title: "Restafval buitenzetten",
      scheduled_date: "2026-10-05",
      scheduled_time: "21:00",
      available_from: null,
      due_at: "2026-10-06T05:45:00.000Z",
      description: "Mag vanaf 22:00 buiten, uiterlijk 07:45.",
      waste_pickup_date: "2026-10-06",
      waste_direction: "out",
      waste_streams: ["rest"],
    });
  });
  it("binnenzetten: D, beschikbaar vanaf 12:00, deadline einde van D", () => {
    const f = wasteTaskFields("2026-10-06", "in", ["rest"], TZ);
    expect(f).toMatchObject({
      title: "Restafvalbak binnenzetten",
      scheduled_date: "2026-10-06",
      scheduled_time: null,
      available_from: "2026-10-06T10:00:00.000Z",
      due_at: "2026-10-06T22:00:00.000Z",
    });
  });
  it.each([
    // [D, out-deadline (07:45 lokaal), in vanaf 12:00 lokaal]
    ["2026-10-26", "2026-10-26T06:45:00.000Z", "2026-10-26T11:00:00.000Z"],
    ["2027-03-29", "2027-03-29T05:45:00.000Z", "2027-03-29T10:00:00.000Z"],
    ["2026-10-25", "2026-10-25T06:45:00.000Z", "2026-10-25T11:00:00.000Z"],
  ])("zomer- en wintertijd: D %s", (d, due, from) => {
    expect(wasteTaskFields(d, "out", ["rest"], TZ).due_at).toBe(due);
    expect(wasteTaskFields(d, "in", ["rest"], TZ).available_from).toBe(from);
  });
});

describe("classifyStream — alleen rest, papier en PMD (AC-196)", () => {
  it.each([
    [{ id: "1", title: "Restafval", icon: "zak-grijs-rest" }, "rest"],
    [{ id: "2", title: "Papier en karton", icon: "doos-karton-papier" }, "papier"],
    [{ id: "3", title: "PMD", icon: "petfles-blik-drankpak_pmd" }, "pmd"],
    [{ id: "4", title: "Plastic, metaal en drankpakken" }, "pmd"],
    [{ id: "5", title: "Restafval (container)" }, "rest"],
    [{ id: "6", title: "GFT", icon: "appel-gft" }, null],
    [{ id: "7", title: "Grofvuil" }, null],
    [{ id: "8", title: "Kerstbomen" }, null],
    [{ id: "9", title: "Textiel" }, null],
    [{ id: "10", title: "Iets onbekends" }, null],
  ])("%j → %s", (def, expected) => {
    expect(classifyStream(def)).toBe(expected);
  });
});

describe("adres (AC-184, AC-187)", () => {
  it("'2511ab' + '12 a' ≡ '2511 AB' + '12A' → 2511AB, 12, A", () => {
    const a = normalizeWasteAddress({ postcode: "2511ab", houseNumber: "12 a", suffix: null });
    const b = normalizeWasteAddress({ postcode: "2511 AB", houseNumber: "12A", suffix: null });
    expect(a).toEqual({ ok: true, value: { postcode: "2511AB", houseNumber: 12, suffix: "A" } });
    expect(b).toEqual(a);
  });
  it("losse toevoeging en 12-2", () => {
    expect(normalizeWasteAddress({ postcode: "2517AB", houseNumber: "12", suffix: "a" })).toMatchObject({ value: { suffix: "A" } });
    expect(normalizeWasteAddress({ postcode: "2517AB", houseNumber: "12-2", suffix: null })).toMatchObject({ value: { houseNumber: 12, suffix: "2" } });
    expect(normalizeWasteAddress({ postcode: "2517AB", houseNumber: 12, suffix: null })).toMatchObject({ value: { suffix: null } });
    expect(normalizeWasteAddress({ postcode: "2517AB", houseNumber: 12, suffix: "" })).toMatchObject({ value: { suffix: "" } });
  });
  it.each([
    [{ postcode: "0123AB", houseNumber: "1" }, "postcode"],
    [{ postcode: "2511A", houseNumber: "1" }, "postcode"],
    [{ postcode: "25111AB", houseNumber: "1" }, "postcode"],
    [{ postcode: "2511AB", houseNumber: "" }, "houseNumber"],
    [{ postcode: "2511AB", houseNumber: "abc" }, "houseNumber"],
    [{ postcode: "2511AB", houseNumber: "0" }, "houseNumber"],
    [{ postcode: "2511AB", houseNumber: "100000" }, "houseNumber"],
    [{ postcode: "2511AB", houseNumber: "12", suffix: "ABCDE" }, "suffix"],
  ])("ongeldig %j → %s", (raw, field) => {
    expect(normalizeWasteAddress({ suffix: null, ...raw })).toMatchObject({ ok: false, field });
  });

  const c = (bagId: string, letter: string | null, toev: string | null = null): AddressCandidate => ({
    bagId,
    huisletter: letter,
    huisnummerToevoeging: toev,
  });
  it("één kandidaat zonder toevoeging opgegeven → die", () => {
    expect(matchCandidate([c("0518200000000001", null)], 12, null)).toMatchObject({ kind: "match", suffix: "" });
  });
  it("meerdere kandidaten zonder toevoeging → kiezen, de app kiest niet zelf", () => {
    const result = matchCandidate([c("0518200000000001", null), c("0518200000000002", "A"), c("0518200000000003", "B")], 12, null);
    expect(result).toEqual({
      kind: "choose",
      options: [
        { suffix: "", label: "12" },
        { suffix: "A", label: "12A" },
        { suffix: "B", label: "12B" },
      ],
    });
  });
  it("bewust zonder letter (suffix '') kiest '12'; onbekende toevoeging → not_found; leeg → not_found", () => {
    const list = [c("0518200000000001", null), c("0518200000000002", "A")];
    expect(matchCandidate(list, 12, "")).toMatchObject({ kind: "match", suffix: "", candidate: { bagId: "0518200000000001" } });
    expect(matchCandidate(list, 12, "Z")).toEqual({ kind: "not_found" });
    expect(matchCandidate([], 12, null)).toEqual({ kind: "not_found" });
  });
});

const task = (id: string, d: string, dir: "out" | "in", status: ExistingWasteTask["status"] = "todo", streams = ["rest"]): ExistingWasteTask => ({
  id,
  status,
  waste_pickup_date: d,
  waste_direction: dir,
  waste_streams: streams,
});

describe("planWasteTasks (AC-197…AC-203)", () => {
  // Donderdag 1 oktober 2026, 10:00 lokaal
  const NOW = at("2026-10-01T08:00:00Z");

  it("venster vandaag t/m vandaag + 14: +3 en +14 wel, +15 niet (AC-197)", () => {
    const plan = planWasteTasks({ pickups: { rest: ["2026-10-04", "2026-10-15", "2026-10-16"] }, existing: [], now: NOW, timeZone: TZ });
    expect(plan.insert.map((t) => `${t.waste_pickup_date}|${t.waste_direction}`)).toEqual([
      "2026-10-04|out",
      "2026-10-04|in",
      "2026-10-15|out",
      "2026-10-15|in",
    ]);
  });

  it("één taak per dag en richting met alle bakken (AC-195)", () => {
    const plan = planWasteTasks({ pickups: { rest: ["2026-10-06"], papier: ["2026-10-06"] }, existing: [], now: NOW, timeZone: TZ });
    expect(plan.insert.map((t) => t.title)).toEqual(["Restafval en papier buitenzetten", "Restafval- en papierbak binnenzetten"]);
  });

  it("tweede ronde: niets meer (idempotent; elke status telt als bestaand)", () => {
    const existing = [task("a", "2026-10-06", "out", "done"), task("b", "2026-10-06", "in", "skipped")];
    const plan = planWasteTasks({ pickups: { rest: ["2026-10-06"] }, existing, now: NOW, timeZone: TZ });
    expect(plan).toEqual({ insert: [], rename: [], remove: [] });
  });

  it("verschoven dag (feestdag): remove D, insert D′ (AC-198)", () => {
    const now = at("2026-12-20T10:00:00Z");
    const existing = [task("o", "2026-12-25", "out"), task("i", "2026-12-25", "in")];
    const plan = planWasteTasks({ pickups: { rest: ["2026-12-26"] }, existing, now, timeZone: TZ });
    expect(plan.remove.sort()).toEqual(["i", "o"]);
    expect(plan.insert.map((t) => `${t.waste_pickup_date}|${t.waste_direction}|${t.scheduled_date}`)).toEqual([
      "2026-12-26|out|2026-12-25",
      "2026-12-26|in|2026-12-26",
    ]);
  });

  it("dag verdwijnt: beide open taken weg (AC-199)", () => {
    const existing = [task("o", "2026-10-06", "out"), task("i", "2026-10-06", "in")];
    expect(planWasteTasks({ pickups: { rest: ["2026-10-09"] }, existing, now: NOW, timeZone: TZ }).remove.sort()).toEqual(["i", "o"]);
  });

  it("dag verdwijnt terwijl de bak al buiten staat: binnenzetten blijft (AC-200)", () => {
    const existing = [task("o", "2026-10-06", "out", "done"), task("i", "2026-10-06", "in")];
    const plan = planWasteTasks({ pickups: { rest: ["2026-10-07"] }, existing, now: NOW, timeZone: TZ });
    expect(plan.remove).toEqual([]);
    expect(plan.insert.map((t) => `${t.waste_pickup_date}|${t.waste_direction}`)).toEqual(["2026-10-07|out", "2026-10-07|in"]);
  });

  it("bak erbij of eraf: open taak hernoemd, gedane niet (AC-201)", () => {
    const existing = [task("o", "2026-10-06", "out", "todo", ["rest", "papier"]), task("i", "2026-10-06", "in", "done", ["rest", "papier"])];
    const plan = planWasteTasks({ pickups: { rest: ["2026-10-06"] }, existing, now: NOW, timeZone: TZ });
    expect(plan.rename).toEqual([{ id: "o", title: "Restafval buitenzetten", waste_streams: ["rest"] }]);
    const meer = planWasteTasks({ pickups: { rest: ["2026-10-06"], papier: ["2026-10-06"], pmd: ["2026-10-06"] }, existing, now: NOW, timeZone: TZ });
    expect(meer.rename).toEqual([{ id: "o", title: "Restafval, papier en PMD buitenzetten", waste_streams: ["rest", "papier", "pmd"] }]);
  });

  it("taken van vóór vandaag worden nooit geraakt", () => {
    const existing = [task("oud", "2026-09-29", "in")];
    expect(planWasteTasks({ pickups: { rest: [] }, existing, now: NOW, timeZone: TZ })).toEqual({ insert: [], rename: [], remove: [] });
  });

  describe("laat ontdekte ophaaldag wo 7 okt 2026 (AC-203)", () => {
    const plan = (iso: string) =>
      planWasteTasks({ pickups: { rest: ["2026-10-07"] }, existing: [], now: at(iso), timeZone: TZ }).insert.map((t) => t.waste_direction);
    it("(a) di 21:40 → buiten + binnen", () => expect(plan("2026-10-06T19:40:00Z")).toEqual(["out", "in"]));
    it("(b) di 23:00 → buiten + binnen", () => expect(plan("2026-10-06T21:00:00Z")).toEqual(["out", "in"]));
    it("(c) wo 08:00 → alleen binnen", () => expect(plan("2026-10-07T06:00:00Z")).toEqual(["in"]));
    it("(d) wo 19:45 → alleen binnen", () => expect(plan("2026-10-07T17:45:00Z")).toEqual(["in"]));
    it("(e) do 00:10 → niets", () => expect(plan("2026-10-07T22:10:00Z")).toEqual([]));
  });
});

describe("isSuspectEmpty (BR-52, AC-204)", () => {
  it("alle drie leeg in het venster = verdacht; alleen papier leeg = normaal", () => {
    expect(isSuspectEmpty({ rest: [], papier: [], pmd: [] }, "2026-12-28")).toBe(true);
    expect(isSuspectEmpty({ rest: ["2027-01-20"] }, "2026-12-28")).toBe(true);
    expect(isSuspectEmpty({ rest: ["2026-12-30"], papier: [], pmd: ["2027-01-02"] }, "2026-12-28")).toBe(false);
  });
});

describe("findExpiredWasteTasks (BR-54, AC-210)", () => {
  const t = (id: string, d: string, dir: "out" | "in", status: ExistingWasteTask["status"] = "todo"): ExpiryWasteTask => ({
    ...task(id, d, dir, status),
    scheduled_date: dir === "out" ? addDay(d, -1) : d,
  });
  function addDay(d: string, n: number) {
    const x = new Date(`${d}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  }
  // Ophaaldag di 6 okt, volgende vr 9 okt (buitenzetten do 8 okt)
  const tasks = [t("o6", "2026-10-06", "out"), t("i6", "2026-10-06", "in"), t("o9", "2026-10-09", "out"), t("i9", "2026-10-09", "in")];
  it("di zelf: niets", () => expect(findExpiredWasteTasks(tasks, "2026-10-06")).toEqual([]));
  it("wo: buitenzetten vervalt, binnenzetten nog niet", () => expect(findExpiredWasteTasks(tasks, "2026-10-07")).toEqual(["o6"]));
  it("do (dag van de volgende buitenzet-taak): ook binnenzetten", () => expect(findExpiredWasteTasks(tasks, "2026-10-08").sort()).toEqual(["i6", "o6"]));
  it("gedane taken vervallen nooit", () => {
    expect(findExpiredWasteTasks([t("o6", "2026-10-06", "out", "done"), t("i6", "2026-10-06", "in", "done")], "2026-10-20")).toEqual([]);
  });
  it("opeenvolgende ophaaldagen: binnenzetten vervalt niet op de ophaaldag zelf", () => {
    const list = [t("o6", "2026-10-06", "out"), t("i6", "2026-10-06", "in"), t("o7", "2026-10-07", "out"), t("i7", "2026-10-07", "in")];
    // di 6 okt: o7 staat gepland op di 6 okt, maar binnenzetten van di is nog niet verlopen
    expect(findExpiredWasteTasks(list, "2026-10-06")).toEqual([]);
    expect(findExpiredWasteTasks(list, "2026-10-07").sort()).toEqual(["i6", "o6"]);
  });
});

describe("wasteReminder (BR-55, AC-194, AC-203, AC-211)", () => {
  const out: WasteReminderTask = { id: "t1", title: "Restafval en papier buitenzetten", status: "todo", waste_direction: "out", waste_pickup_date: "2026-10-06", waste_streams: ["rest", "papier"] };
  const inn: WasteReminderTask = { ...out, id: "t2", title: "Restafval- en papierbak binnenzetten", waste_direction: "in" };

  it("ma 21:00 één herinnering met 'vanaf 22:00'", () => {
    const [m, ...rest] = wasteReminder(out, at("2026-10-05T19:00:00Z"), TZ);
    expect(rest).toEqual([]);
    expect(m).toEqual({
      type: "reminder",
      title: "Herinnering: Restafval en papier buitenzetten",
      body: "Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45.",
      taskId: "t1",
      dedupeKey: "waste:out:2026-10-06:2026-10-05T19:00:00.000Z",
    });
  });
  it("di 18:00 binnenzetten, meervoud en enkelvoud", () => {
    expect(wasteReminder(inn, at("2026-10-06T16:05:00Z"), TZ)[0]?.body).toBe("Vandaag was de ophaaldag. Zet de bakken vandaag nog binnen.");
    expect(wasteReminder({ ...inn, waste_streams: ["rest"] }, at("2026-10-06T16:05:00Z"), TZ)[0]?.body).toBe(
      "Vandaag was de ophaaldag. Zet de bak vandaag nog binnen.",
    );
  });
  it("afgevinkt of overgeslagen → niets (a, b)", () => {
    expect(wasteReminder({ ...out, status: "done" }, at("2026-10-05T19:00:00Z"), TZ)).toEqual([]);
    expect(wasteReminder({ ...inn, status: "skipped" }, at("2026-10-06T16:00:00Z"), TZ)).toEqual([]);
  });
  it("vóór het anker en ≥ 90 minuten erna → niets; nooit deadline of verlopen", () => {
    expect(wasteReminder(out, at("2026-10-05T18:59:00Z"), TZ)).toEqual([]);
    expect(wasteReminder(out, at("2026-10-05T20:30:00Z"), TZ)).toEqual([]);
    for (const iso of ["2026-10-06T05:30:00Z", "2026-10-06T06:00:00Z", "2026-10-06T23:00:00Z"]) {
      expect(wasteReminder(out, at(iso), TZ)).toEqual([]);
    }
  });
});

describe("gezondheid en ophalen (BR-52, AC-204, AC-205)", () => {
  const base: WasteSyncState = {
    last_attempt_at: "2026-10-01T04:15:00Z",
    last_success_at: "2026-10-01T04:15:00Z",
    last_error_code: null,
    failure_count: 0,
    first_failure_at: null,
  };
  it("ok, retrying, stale na 48 uur", () => {
    expect(wasteSyncHealth(base, at("2026-10-01T10:00:00Z"))).toEqual({ state: "ok" });
    expect(wasteSyncHealth({ ...base, last_error_code: "UNREACHABLE", failure_count: 3 }, at("2026-10-02T10:00:00Z"))).toEqual({ state: "retrying" });
    expect(wasteSyncHealth({ ...base, last_error_code: "UNREACHABLE" }, at("2026-10-03T04:16:00Z"))).toEqual({ state: "failed", reason: "stale" });
  });
  it("aanhoudend leeg: twee pogingen én minstens een uur (snel opnieuw proberen telt niet)", () => {
    const leeg = { ...base, last_error_code: "SUSPECT_EMPTY" as const, failure_count: 2, first_failure_at: "2026-10-01T05:00:00Z" };
    expect(wasteSyncHealth(leeg, at("2026-10-01T05:02:00Z"))).toEqual({ state: "retrying" });
    expect(wasteSyncHealth(leeg, at("2026-10-01T06:00:00Z"))).toEqual({ state: "failed", reason: "empty" });
    expect(wasteSyncHealth({ ...leeg, failure_count: 1 }, at("2026-10-01T07:00:00Z"))).toEqual({ state: "retrying" });
  });
  it("dueForFetch: dagelijks vanaf 06:00, na een fout elk uur, nooit binnen het uur", () => {
    const gisteren = { ...base, last_attempt_at: "2026-09-30T04:15:00Z", last_success_at: "2026-09-30T04:15:00Z" };
    expect(dueForFetch(gisteren, at("2026-10-01T03:30:00Z"), TZ)).toBe(false); // 05:30 lokaal
    expect(dueForFetch(gisteren, at("2026-10-01T04:05:00Z"), TZ)).toBe(true); // 06:05 lokaal
    expect(dueForFetch(base, at("2026-10-01T10:00:00Z"), TZ)).toBe(false); // vandaag al gelukt
    const fout = { ...base, last_error_code: "UNREACHABLE" as const, last_attempt_at: "2026-10-01T09:30:00Z" };
    expect(dueForFetch(fout, at("2026-10-01T10:00:00Z"), TZ)).toBe(false);
    expect(dueForFetch(fout, at("2026-10-01T10:31:00Z"), TZ)).toBe(true);
  });
  it("storingsmelding zonder adres, één per storing (dedupe op laatste succes)", () => {
    const m = wasteFailureMessage("stale", "2026-09-26T04:15:00Z", TZ);
    expect(m.title).toBe("De afvalkalender kon niet worden bijgewerkt");
    expect(m.body).toBe(
      "Laatst gelukt op za 26 sep. Nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl.",
    );
    expect(m.dedupeKey).toBe("waste-failed:2026-09-26T04:15:00.000Z");
    expect(wasteFailureMessage("empty", "2026-09-26T04:15:00Z", TZ).dedupeKey).toBe(m.dedupeKey);
  });
});

describe("ontvangers storingsmelding (AC-205)", () => {
  it("alle actieve beheerders met account, los van voorkeuren; geen gezinslid of uitgezet lid", () => {
    const members = [
      { id: "jurgen", user_id: "u1", is_active: true, role: "admin" as const },
      { id: "ellen", user_id: "u2", is_active: true, role: "admin" as const },
      { id: "lynn", user_id: "u3", is_active: true, role: "member" as const },
      { id: "kai", user_id: "u4", is_active: false, role: "admin" as const },
    ];
    expect(recipientsFor("waste_sync_failed", members, [{ member_id: "ellen", notify_reminders: false }]).sort()).toEqual(["ellen", "jurgen"]);
  });
});

describe("geen adres of namen in teksten (AC-212)", () => {
  it("taken, herinneringen en storingsmeldingen bevatten alleen bak en dag", () => {
    const fields = [
      ...planWasteTasks({ pickups: { rest: ["2026-10-06"], papier: ["2026-10-06"], pmd: ["2026-10-08"] }, existing: [], now: at("2026-10-01T08:00:00Z"), timeZone: TZ }).insert,
    ];
    const texts = [
      ...fields.flatMap((f) => [f.title, f.description]),
      ...wasteReminder({ id: "x", title: fields[0].title, status: "todo", waste_direction: "out", waste_pickup_date: "2026-10-06", waste_streams: ["rest"] }, at("2026-10-05T19:00:00Z"), TZ).flatMap((m) => [m.title, m.body ?? ""]),
      ...(["stale", "empty"] as const).flatMap((r) => Object.values(wasteFailureMessage(r, "2026-09-26T04:15:00Z", TZ))),
    ].join("\n");
    for (const forbidden of ["2591", "87", "0518", "Jurgen", "Ellen", "Lynn", "Laan", "straat"]) {
      expect(texts).not.toContain(forbidden);
    }
  });
});
