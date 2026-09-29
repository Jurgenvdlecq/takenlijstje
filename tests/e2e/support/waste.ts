/**
 * Hulpmiddelen voor de E2E-tests van de afvalkalender (WP3b):
 * de stub van de gemeentebron besturen, en de testdatabase in een bekende
 * stand zetten (service role van de LOKALE stack, zoals support/db.ts).
 */
import { adminDb } from "./db";

export const STUB_URL = `http://127.0.0.1:${process.env.E2E_WASTE_STUB_PORT ?? 4599}`;
/** Adrescode van het P0-testadres 2591 BB 87 (zelfde als in waste-stub.mjs) */
export const BAG_ID = "0518200000813196";

export type StubScenario =
  | "normaal"
  | "normaal_b"
  | "meerdere"
  | "onbekend"
  | "alleen_gft"
  | "onbereikbaar"
  | "leeg"
  | "adres_weg"
  | "jaareinde"
  | "kerstbomen_j1"
  | "drie_weken"
  | "verschuiving"
  | "traag";

/** Wisselt het scenario en zet de teller op 0 */
export async function stubScenario(scenario: StubScenario, delayMs?: number) {
  const res = await fetch(`${STUB_URL}/__stub/scenario`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenario, delayMs }),
  });
  if (!res.ok) throw new Error(`stub: ${res.status}`);
}

/** Aantal verzoeken per pad sinds het laatste scenario-wissel */
export async function stubCounts(): Promise<Record<string, number>> {
  return (await fetch(`${STUB_URL}/__stub/counts`)).json();
}

export async function stubTotal(): Promise<number> {
  return Object.values(await stubCounts()).reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Datums en tijden (Europe/Amsterdam)
// ---------------------------------------------------------------------------

/** YYYY-MM-DD van vandaag + n dagen in Amsterdam */
export function day(offset = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** <dag> uit UX §13.16: "di 6 okt" (onafhankelijk nagebouwd, niet uit de app) */
export function dag(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Het UTC-moment van een Amsterdamse wandkloktijd, als ISO-string */
export function amsterdam(isoDate: string, time: string): string {
  const guess = new Date(`${isoDate}T${time}:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Amsterdam",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess.getTime() - (wall - guess.getTime())).toISOString();
}

/** "hh:mm" in Amsterdam */
export function klok(instant: string | Date): string {
  return new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(instant),
  );
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

/** Adres en alle afvaltaken van het huishouden weg (voor elke test) */
export async function clearWaste(householdId: string) {
  const db = adminDb();
  const t = await db.from("tasks").delete().eq("household_id", householdId).not("waste_direction", "is", null);
  if (t.error) throw new Error(`afvaltaken wissen: ${JSON.stringify(t.error)}`);
  const c = await db.from("waste_calendars").delete().eq("household_id", householdId);
  if (c.error) throw new Error(`afvalkalender wissen: ${JSON.stringify(c.error)}`);
}

export interface CalendarState {
  last_success_at?: string;
  last_error_code?: "UNREACHABLE" | "FORMAT" | "SUSPECT_EMPTY" | "ADDRESS_GONE" | null;
  error_since?: string | null;
  last_failure_at?: string | null;
  alarm_since?: string | null;
  last_attempt_at?: string | null;
  pickups?: { rest: string[]; papier: string[]; pmd: string[] };
}

/** Standaard bewaarde stand: rest D+2 en D+9, papier D+2, PMD D+9 */
export function storedPickups() {
  return { rest: [day(2), day(9)], papier: [day(2)], pmd: [day(9)] };
}

/** Bewaard adres 2591 BB 87 in een gekozen gezondheidsstand */
export async function insertCalendar(householdId: string, state: CalendarState = {}) {
  const now = Date.now();
  const row = {
    household_id: householdId,
    postcode: "2591BB",
    house_number: 87,
    house_suffix: "",
    bag_id: BAG_ID,
    pickups: storedPickups(),
    last_success_at: new Date(now - 10 * 60_000).toISOString(),
    last_attempt_at: null,
    last_error_code: null,
    error_since: null,
    last_failure_at: null,
    alarm_since: null,
    ...state,
  };
  const { error } = await adminDb().from("waste_calendars").insert(row as never);
  if (error) throw new Error(`afvalkalender klaarzetten: ${JSON.stringify(error)}`);
}

export async function calendarRow(householdId: string) {
  const { data, error } = await adminDb().from("waste_calendars").select("*").eq("household_id", householdId);
  if (error) throw new Error(JSON.stringify(error));
  return (data as Record<string, unknown>[])[0] ?? null;
}

export async function updateCalendar(householdId: string, patch: CalendarState) {
  const { error } = await adminDb().from("waste_calendars").update(patch as never).eq("household_id", householdId);
  if (error) throw new Error(JSON.stringify(error));
}

export interface WasteTaskRow {
  id: string;
  title: string;
  status: string;
  waste_pickup_date: string;
  waste_direction: "out" | "in";
  waste_streams: string[];
}

export async function wasteTasks(householdId: string): Promise<WasteTaskRow[]> {
  const { data, error } = await adminDb()
    .from("tasks")
    .select("id, title, status, waste_pickup_date, waste_direction, waste_streams")
    .eq("household_id", householdId)
    .not("waste_direction", "is", null)
    .order("waste_pickup_date");
  if (error) throw new Error(JSON.stringify(error));
  return (data ?? []) as unknown as WasteTaskRow[];
}

const OUT_TITLE: Record<string, string> = { rest: "Restafval buitenzetten", papier: "Papier buitenzetten", pmd: "PMD buitenzetten" };
const IN_TITLE: Record<string, string> = { rest: "Restafvalbak binnenzetten", papier: "Papierbak binnenzetten", pmd: "PMD-bak binnenzetten" };

/**
 * Een afvaltaak zoals het systeem hem maakt (TD §18.4.2), ingevoegd met de
 * service role. Velden hier met de hand, zodat de test niet op de
 * productiefunctie leunt.
 */
export async function insertWasteTask(
  householdId: string,
  pickupDate: string,
  direction: "out" | "in",
  stream: "rest" | "papier" | "pmd" = "rest",
  status: "todo" | "in_progress" | "done" | "skipped" = "todo",
) {
  const prev = new Date(`${pickupDate}T12:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const next = new Date(`${pickupDate}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const row =
    direction === "out"
      ? {
          scheduled_date: prev.toISOString().slice(0, 10),
          scheduled_time: "21:00",
          available_from: null,
          due_at: amsterdam(pickupDate, "07:45"),
          title: OUT_TITLE[stream],
        }
      : {
          scheduled_date: pickupDate,
          scheduled_time: null,
          available_from: amsterdam(pickupDate, "12:00"),
          due_at: amsterdam(next.toISOString().slice(0, 10), "00:00"),
          title: IN_TITLE[stream],
        };
  const { data, error } = await adminDb()
    .from("tasks")
    .insert({
      household_id: householdId,
      ...row,
      description: null,
      category: "outdoor",
      priority: "normal",
      reminder_minutes_before: [],
      created_by_member_id: null,
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      waste_pickup_date: pickupDate,
      waste_direction: direction,
      waste_streams: [stream],
    } as never)
    .select("id, title")
    .single();
  if (error) throw new Error(`afvaltaak klaarzetten: ${JSON.stringify(error)}`);
  return data as { id: string; title: string };
}

/** Teller van de opzoekgrens (D-049, 20 per uur per huishouden) op nul, zodat tests elkaar niet raken */
export async function clearLookupWindow(householdId: string) {
  const { error } = await adminDb().from("waste_lookup_windows").delete().eq("household_id", householdId);
  if (error) throw new Error(`opzoekteller wissen: ${JSON.stringify(error)}`);
}

/** Zet de opzoekteller van dit uur op een gekozen stand */
export async function setLookupCount(householdId: string, lookups: number) {
  const { error } = await adminDb()
    .from("waste_lookup_windows")
    .upsert({ household_id: householdId, window_start: new Date().toISOString(), lookups } as never, { onConflict: "household_id" });
  if (error) throw new Error(`opzoekteller zetten: ${JSON.stringify(error)}`);
}

export async function setRole(memberId: string, role: "admin" | "member") {
  const { error } = await adminDb().from("household_members").update({ role } as never).eq("id", memberId);
  if (error) throw new Error(JSON.stringify(error));
}
