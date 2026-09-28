/**
 * Voorbeelddata voor demo en testen (zie README).
 *
 *   npm run seed            – maakt huishouden "Familie" met Jurgen, Ellen, Lynn en Kai
 *   npm run seed -- --reset – verwijdert eerst een bestaand demohuishouden
 *
 * Vereist NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY (bijv. in .env.local).
 * Inloggen daarna met jurgen@example.com / ellen@example.com / lynn@example.com /
 * kai@example.com, wachtwoord: Welkom123!
 * Taken horen bij het huishouden: er wordt niets toegewezen en niet
 * vastgelegd wie iets afvinkte (V-21).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { addDays, isoWeekday, todayIn, zonedInstant, type ISODate } from "../src/domain/dates";
import type { RecurrenceRule } from "../src/domain/recurrence/rule";
import { occurrencesBetween } from "../src/domain/recurrence/occurrences";
import { planSeries, type SeriesDefinition } from "../src/domain/scheduling/plan";
import type { Database, MemberRow, RecurrenceRow, TaskRow } from "../src/types/database";

config({ path: ".env.local" });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Zet NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY (bijv. in .env.local).");
  process.exit(1);
}

const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const TZ = "Europe/Amsterdam";
const PASSWORD = "Welkom123!";
const HOUSEHOLD_NAME = "Familie";

function must<R extends { data: unknown; error: unknown }>(result: R, label: string): NonNullable<R["data"]> {
  if (result.error) {
    console.error(`✗ ${label}`, result.error);
    process.exit(1);
  }
  return result.data as NonNullable<R["data"]>;
}

/** Voorspelbare "willekeur" zodat de demo er iedere keer hetzelfde uitziet. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

async function ensureUser(email: string, displayName: string): Promise<string> {
  const created = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (created.data.user) return created.data.user.id;
  // Bestaat al: opzoeken
  const list = must(await db.auth.admin.listUsers({ perPage: 1000 }), "gebruikers ophalen");
  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw new Error(`Kon gebruiker ${email} niet aanmaken: ${created.error?.message}`);
  return existing.id;
}

interface SeriesSeed {
  title: string;
  template: string;
  rule: RecurrenceRule;
  time?: string;
  availableDaysBefore?: number;
  dueDaysAfter?: number;
  dueTime?: string;
  reminders?: number[];
}

async function main() {
  const reset = process.argv.includes("--reset");
  const today = todayIn(TZ);
  const historyStart = addDays(today, -21);

  // --- accounts -----------------------------------------------------------------
  const [jurgenUser, ellenUser, lynnUser, kaiUser] = await Promise.all([
    ensureUser("jurgen@example.com", "Jurgen"),
    ensureUser("ellen@example.com", "Ellen"),
    ensureUser("lynn@example.com", "Lynn"),
    ensureUser("kai@example.com", "Kai"),
  ]);

  const { data: existing } = await db.from("households").select("id").eq("name", HOUSEHOLD_NAME).eq("created_by", jurgenUser);
  if (existing?.length) {
    if (!reset) {
      console.log(`Huishouden "${HOUSEHOLD_NAME}" bestaat al. Gebruik --reset om opnieuw te beginnen.`);
      return;
    }
    must(await db.from("households").delete().in("id", existing.map((h) => h.id)), "oud huishouden verwijderen");
  }

  // --- huishouden + gezinsleden ------------------------------------------------------
  const household = must(
    await db
      .from("households")
      .insert({
        name: HOUSEHOLD_NAME,
        timezone: TZ,
        created_by: jurgenUser,
        onboarding_completed: true,
        members_can_create_tasks: true,
      })
      .select("*")
      .single(),
    "huishouden",
  );

  const members = must(
    await db
      .from("household_members")
      .insert([
        { household_id: household.id, user_id: jurgenUser, display_name: "Jurgen", color: "#2563eb", icon: "🧔", role: "admin", sort_order: 0 },
        { household_id: household.id, user_id: ellenUser, display_name: "Ellen", color: "#db2777", icon: "👩", role: "admin", sort_order: 1 },
        { household_id: household.id, user_id: lynnUser, display_name: "Lynn", color: "#16a34a", icon: "👧", role: "member", sort_order: 2 },
        { household_id: household.id, user_id: kaiUser, display_name: "Kai", color: "#f59e0b", icon: "👦", role: "member", sort_order: 3 },
      ])
      .select("*"),
    "gezinsleden",
  ) as MemberRow[];
  const id = (name: string) => members.find((m) => m.display_name === name)!.id;
  const [J, E, L] = ["Jurgen", "Ellen", "Lynn"].map(id);

  // Meldingsvoorkeuren: Jurgen wil ook horen als iets gedaan is
  must(await db.from("user_preferences").update({ notify_task_completed: true }).eq("member_id", J), "voorkeuren");

  const templates = must(await db.from("task_templates").select("id, slug").is("household_id", null), "sjablonen");
  const templateId = (slug: string) => templates.find((t) => t.slug === slug)?.id ?? null;

  // --- terugkerende taken (punt 36 van de specificatie) -------------------------------
  const seeds: SeriesSeed[] = [
    { title: "Badkamer schoonmaken", template: "bathroom", rule: { freq: "weekly", interval: 1, weekdays: [6] }, availableDaysBefore: 1, dueDaysAfter: 1, dueTime: "18:00" },
    { title: "WC schoonmaken", template: "toilet", rule: { freq: "weekly", interval: 1, weekdays: [3, 7] }, reminders: [120] },
    { title: "Boodschappenlijst maken", template: "grocery-list", rule: { freq: "weekly", interval: 1, weekdays: [5] }, time: "18:00" },
    { title: "Boodschappen doen", template: "groceries", rule: { freq: "weekly", interval: 1, weekdays: [6] }, time: "10:00", reminders: [60] },
    { title: "Stofzuigen", template: "vacuum", rule: { freq: "weekly", interval: 1, weekdays: [2, 6] } },
    { title: "Dweilen", template: "mop", rule: { freq: "weekly", interval: 1, weekdays: [7] } },
    { title: "Bed verschonen", template: "change-bed", rule: { freq: "weekly", interval: 2, weekdays: [7] } },
    { title: "Vaatwasser uitruimen", template: "dishwasher-empty", rule: { freq: "daily", interval: 1 } },
    // Afvaldag = woensdag: de avond ervoor buiten zetten
    { title: "Afvalcontainer buiten zetten", template: "bin-out", rule: { freq: "weekly", interval: 1, weekdays: [2] }, time: "20:00", reminders: [0] },
  ];

  const templateRows = must(
    await db.from("task_templates").select("*").in("id", seeds.map((s) => templateId(s.template)).filter((v): v is string => !!v)),
    "sjabloondetails",
  );

  const recurrences = must(
    await db
      .from("task_recurrences")
      .insert(
        seeds.map((s) => {
          const t = templateRows.find((r) => r.id === templateId(s.template));
          return {
            household_id: household.id,
            template_id: t?.id ?? null,
            title: s.title,
            category: t?.category ?? "other",
            duration_minutes: t?.duration_minutes ?? null,
            rule: s.rule,
            time_of_day: s.time ?? null,
            available_days_before: s.availableDaysBefore ?? 0,
            due_days_after: s.dueDaysAfter ?? 0,
            due_time: s.dueTime ?? null,
            starts_on: historyStart,
            reminder_minutes_before: s.reminders ?? [],
            created_by_member_id: J,
          };
        }),
      )
      .select("*"),
    "reeksen",
  ) as RecurrenceRow[];

  const random = seeded(42);
  const toSeries = (r: RecurrenceRow): SeriesDefinition => ({
    id: r.id,
    rule: r.rule,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    pausedFrom: r.paused_from,
    pausedUntil: r.paused_until,
    timeOfDay: r.time_of_day?.slice(0, 5) ?? null,
    availableDaysBefore: r.available_days_before,
    dueDaysAfter: r.due_days_after,
    dueTime: r.due_time?.slice(0, 5) ?? null,
    durationMinutes: r.duration_minutes,
    generatedUntil: null,
  });

  // --- geschiedenis: de afgelopen drie weken ----------------------------------------------
  const pastTasks: Partial<TaskRow>[] = [];
  const completions: Database["public"]["Tables"]["task_completions"]["Insert"][] = [];

  for (const r of recurrences) {
    const series = toSeries(r);
    const dates = occurrencesBetween(series, historyStart, addDays(today, -1));
    // Plan de uitvoeringen alsof ze toen waren ingepland
    const plan = planSeries({
      series,
      today: historyStart,
      timeZone: TZ,
      existingOccurrenceDates: new Set(),
      hasOpenUpcoming: true,
      horizonDays: 20,
      from: historyStart,
    });

    for (const date of dates) {
      const p = plan.occurrences.find((o) => o.occurrenceDate === date);
      if (!p) continue;
      const roll = random();
      const taskId = crypto.randomUUID();

      if (roll < 0.08) {
        // Soms vergeten → overgeslagen
        pastTasks.push({ id: taskId, household_id: household.id, recurrence_id: r.id, occurrence_date: date, title: r.title, category: r.category, status: "skipped", scheduled_date: p.scheduledDate, scheduled_time: p.scheduledTime, available_from: p.availableFrom, due_at: p.dueAt, duration_minutes: r.duration_minutes, created_by_member_id: J });
        continue;
      }
      // Meestal op tijd, soms een paar uur te laat
      const late = roll > 0.85;
      const doneAt = late
        ? new Date(new Date(p.dueAt).getTime() + (60 + Math.floor(random() * 240)) * 60_000)
        : new Date(new Date(zonedInstant(p.scheduledDate, p.scheduledTime ?? "09:00", TZ)).getTime() + Math.floor(random() * 8 * 60) * 60_000);
      const completedAt = new Date(Math.min(doneAt.getTime(), Date.now() - 60_000)).toISOString();

      pastTasks.push({ id: taskId, household_id: household.id, recurrence_id: r.id, occurrence_date: date, title: r.title, category: r.category, status: "done", scheduled_date: p.scheduledDate, scheduled_time: p.scheduledTime, available_from: p.availableFrom, due_at: p.dueAt, duration_minutes: r.duration_minutes, completed_at: completedAt, created_by_member_id: J });
      const minutesLate = Math.max(0, Math.ceil((new Date(completedAt).getTime() - new Date(p.dueAt).getTime()) / 60_000));
      completions.push({ household_id: household.id, task_id: taskId, recurrence_id: r.id, title: r.title, category: r.category, completed_at: completedAt, scheduled_date: p.scheduledDate, due_at: p.dueAt, was_late: minutesLate > 0, minutes_late: minutesLate, duration_minutes: r.duration_minutes, client_mutation_id: crypto.randomUUID() });
    }
  }

  // In stukken invoegen
  for (let i = 0; i < pastTasks.length; i += 200) must(await db.from("tasks").insert(pastTasks.slice(i, i + 200)), "historische taken");
  for (let i = 0; i < completions.length; i += 200) must(await db.from("task_completions").insert(completions.slice(i, i + 200)), "historie");

  // --- vanaf vandaag: vooruit inplannen (zoals de app dat doet) ---------------------------
  const upcoming: Partial<TaskRow>[] = [];
  for (const r of recurrences) {
    const plan = planSeries({
      series: { ...toSeries(r), generatedUntil: addDays(today, -1) },
      today,
      timeZone: TZ,
      existingOccurrenceDates: new Set(pastTasks.filter((t) => t.recurrence_id === r.id).map((t) => t.occurrence_date!)),
      hasOpenUpcoming: false,
    });
    for (const o of plan.occurrences) {
      upcoming.push({ household_id: household.id, recurrence_id: r.id, occurrence_date: o.occurrenceDate, title: r.title, category: r.category, scheduled_date: o.scheduledDate, scheduled_time: o.scheduledTime, available_from: o.availableFrom, due_at: o.dueAt, duration_minutes: r.duration_minutes, reminder_minutes_before: r.reminder_minutes_before, created_by_member_id: J });
    }
    must(await db.from("task_recurrences").update({ generated_until: plan.generatedUntil }).eq("id", r.id), "horizon");
  }
  const insertedUpcoming = must(await db.from("tasks").insert(upcoming).select("*"), "komende taken") as TaskRow[];

  // Een paar dingen van vandaag al gedaan, zodat het dashboard leeft
  const todayTasks = insertedUpcoming.filter((t) => t.scheduled_date === today);
  for (const t of todayTasks.slice(0, 1)) {
    const completedAt = new Date(Date.now() - 45 * 60_000).toISOString();
    must(await db.from("tasks").update({ status: "done", completed_at: completedAt }).eq("id", t.id), "vandaag gedaan");
    must(
      await db.from("task_completions").insert({ household_id: household.id, task_id: t.id, recurrence_id: t.recurrence_id, title: t.title, category: t.category, completed_at: completedAt, scheduled_date: t.scheduled_date, due_at: t.due_at, duration_minutes: t.duration_minutes, client_mutation_id: crypto.randomUUID() }),
      "historie vandaag",
    );
  }

  // --- losse taken -----------------------------------------------------------------------------
  // Bulk-inserts via PostgREST: iedere rij moet dezelfde velden hebben (ontbrekend = NULL)
  const oneOff = (title: string, date: ISODate, extra: Partial<TaskRow> = {}): Partial<TaskRow> => ({
    household_id: household.id,
    title,
    category: "other",
    priority: "normal",
    scheduled_date: date,
    scheduled_time: null,
    available_from: zonedInstant(date, "00:00", TZ),
    due_at: zonedInstant(date, "23:59", TZ),
    duration_minutes: null,
    created_by_member_id: J,
    ...extra,
  });
  const oneOffs = must(
    await db
      .from("tasks")
      .insert([
        oneOff("Fietsband plakken", addDays(today, -2), { priority: "high", duration_minutes: 20 }),
        oneOff("Tandartsafspraak Kai maken", today, { category: "admin", duration_minutes: 5, scheduled_time: "12:00" }),
        oneOff("Cadeau kopen voor oma", addDays(today, 3), { category: "groceries", priority: "high" }),
        oneOff("Kerstversiering zolder opruimen", addDays(today, 9), { duration_minutes: 45 }),
      ])
      .select("*"),
    "losse taken",
  ) as TaskRow[];

  // --- opmerking (de schrijver zet de database zelf, V-34) ------------------------------------
  const wc = insertedUpcoming.find((t) => t.title === "WC schoonmaken");
  if (wc) {
    must(await db.from("task_comments").insert({ household_id: household.id, task_id: wc.id, member_id: E, body: "WC-reiniger is bijna op." }), "opmerking");
  }

  // --- boodschappen ------------------------------------------------------------------------------
  const list = must(await db.from("shopping_lists").insert({ household_id: household.id }).select("*").single(), "boodschappenlijst");
  must(
    await db.from("shopping_items").insert(
      [
        { name: "Melk", quantity: "2", category: "dairy" as const, note: null, bought: false },
        { name: "Brood", quantity: null, category: "bread" as const, note: null, bought: false },
        { name: "Cola", quantity: "1,5 liter", category: "drinks" as const, note: null, bought: false },
        { name: "Toiletpapier", quantity: null, category: "household" as const, note: "Het zachte merk", bought: false },
        { name: "Bananen", quantity: "6", category: "produce" as const, note: null, bought: true },
        { name: "WC-reiniger", quantity: null, category: "drugstore" as const, note: null, bought: false },
      ].map(({ bought, ...item }) => ({
        ...item,
        household_id: household.id,
        list_id: list.id,
        is_bought: bought,
        bought_at: bought ? new Date().toISOString() : null,
      })),
    ),
    "boodschappen",
  );
  // Oude, gearchiveerde lijst voor "vaak gekocht"
  const old = must(await db.from("shopping_lists").insert({ household_id: household.id, archived_at: addDays(today, -7) + "T12:00:00Z" }).select("*").single(), "oude lijst");
  must(
    await db.from("shopping_items").insert(
      ["Melk", "Kaas", "Eieren", "Pindakaas", "Appels", "Koffie", "Melk", "Kaas"].map((name) => ({
        household_id: household.id,
        list_id: old.id,
        name,
        category: name === "Appels" ? ("produce" as const) : name === "Koffie" ? ("drinks" as const) : ("dairy" as const),
        is_bought: true,
      })),
    ),
    "oude boodschappen",
  );

  // --- meldingen ---------------------------------------------------------------------------------
  must(
    await db.from("notifications").insert([
      { household_id: household.id, member_id: J, type: "daily_summary" as const, title: `Vandaag staan er ${todayTasks.length + 1} taken`, body: null, task_id: null, url: "/", dedupe_key: `daily:${today}`, read_at: null },
      { household_id: household.id, member_id: J, type: "overdue" as const, title: "Fietsband plakken is verlopen", body: null, task_id: oneOffs[0].id, url: null, dedupe_key: `overdue:${oneOffs[0].id}`, read_at: new Date().toISOString() },
    ]),
    "meldingen",
  );

  console.log(`✓ Demohuishouden "${HOUSEHOLD_NAME}" aangemaakt`);
  console.log(`  ${recurrences.length} terugkerende taken, ${pastTasks.length} uitvoeringen in de historie, ${insertedUpcoming.length + oneOffs.length} komende taken`);
  console.log(`  Inloggen: jurgen@example.com / ellen@example.com / lynn@example.com / kai@example.com — wachtwoord ${PASSWORD}`);
  console.log(`  Vandaag is ${["ma", "di", "wo", "do", "vr", "za", "zo"][isoWeekday(today) - 1]} ${today}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
