/**
 * Testdata voor integratietests tegen de LOKALE teststack. Elk scenario maakt
 * een eigen huishouden met eigen accounts (unieke e-mailadressen) en ruimt die
 * na afloop op. Nooit tegen productie: de URL wordt gecontroleerd.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayIn, zonedTime, type ISODate } from "@/domain/dates";
import type { Database, PreferencesRow } from "@/types/database";

export const TZ = "Europe/Amsterdam";

let client: SupabaseClient<Database> | null = null;

/** Service-role-client van de lokale stack, alleen voor klaarzetten en controleren */
export function testDb(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error(`Weiger testdata buiten de lokale stack: ${url}`);
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ontbreekt (zie tests/integration/vitest.config.mts)");
  client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export function must<T>(result: { data: T; error: unknown }, label: string): NonNullable<T> {
  if (result.error) throw new Error(`${label}: ${JSON.stringify(result.error)}`);
  if (result.data === null || result.data === undefined) throw new Error(`${label}: geen data`);
  return result.data as NonNullable<T>;
}

export interface LidSpec {
  naam: string;
  rol: "admin" | "member";
  actief?: boolean;
  prefs?: Partial<PreferencesRow>;
}

export interface Gezin {
  householdId: string;
  leden: Record<string, { memberId: string; userId: string }>;
}

const aangemaakt: { households: string[]; users: string[] } = { households: [], users: [] };

/** Nieuw huishouden met accounts; voorkeuren volgen eerst de standaard (V-23) en daarna `prefs`. */
export async function maakGezin(label: string, leden: LidSpec[]): Promise<Gezin> {
  const db = testDb();
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  for (const lid of leden) {
    const created = await db.auth.admin.createUser({
      email: `int-${label.toLowerCase()}-${lid.naam.toLowerCase()}-${run}@example.com`,
      password: "Welkom123!",
      email_confirm: true,
      user_metadata: { display_name: lid.naam },
    });
    if (!created.data.user) throw new Error(`account ${lid.naam}: ${created.error?.message}`);
    userIds.push(created.data.user.id);
    aangemaakt.users.push(created.data.user.id);
  }
  const household = must(
    await db
      .from("households")
      .insert({ name: `INT ${label} ${run}`, timezone: TZ, created_by: userIds[0], onboarding_completed: true })
      .select("id")
      .single(),
    "huishouden",
  );
  aangemaakt.households.push(household.id);

  const result: Gezin = { householdId: household.id, leden: {} };
  for (const [i, lid] of leden.entries()) {
    const member = must(
      await db
        .from("household_members")
        .insert({ household_id: household.id, user_id: userIds[i], display_name: lid.naam, role: lid.rol, sort_order: i })
        .select("id")
        .single(),
      `lid ${lid.naam}`,
    );
    if (lid.actief === false) must(await db.from("household_members").update({ is_active: false }).eq("id", member.id).select("id"), "uitzetten");
    if (lid.prefs) must(await db.from("user_preferences").update(lid.prefs).eq("member_id", member.id).select("member_id"), "voorkeuren");
    result.leden[lid.naam] = { memberId: member.id, userId: userIds[i] };
  }
  return result;
}

/** Ruimt alle in deze testrun aangemaakte huishoudens en accounts op */
export async function ruimOp(): Promise<void> {
  const db = testDb();
  if (aangemaakt.households.length) await db.from("households").delete().in("id", aangemaakt.households);
  for (const id of aangemaakt.users) await db.auth.admin.deleteUser(id);
  aangemaakt.households = [];
  aangemaakt.users = [];
}

export function vandaag(now: Date, offset = 0): ISODate {
  return addDays(todayIn(TZ, now), offset);
}

/** "HH:MM" van `now` in Amsterdam: een overzicht met deze tijd valt precies in het venster */
export function klokVan(now: Date): string {
  const { hour, minute } = zonedTime(now, TZ);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function minuten(now: Date, delta: number): string {
  return new Date(now.getTime() + delta * 60_000).toISOString();
}

export async function takenVan(householdId: string) {
  return must(
    await testDb()
      .from("tasks")
      .select("id, recurrence_id, occurrence_date, status, scheduled_date, deleted_at")
      .eq("household_id", householdId),
    "taken",
  );
}

export async function meldingenVan(householdId: string) {
  return must(
    await testDb()
      .from("notifications")
      .select("id, member_id, type, title, body, dedupe_key, pushed_at, created_at")
      .eq("household_id", householdId),
    "meldingen",
  );
}
