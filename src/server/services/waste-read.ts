import "server-only";

/**
 * Instellingen › Afvalkalender lezen, met de gebruikersclient (RLS;
 * TECHNICAL_DESIGN §18.6). Een beheerder krijgt adres, gezondheid en de
 * bewaarde ophaaldagen; een gezinslid alleen aan/uit en de namen van de
 * beheerders (V-53).
 */
import { zonedDate } from "@/domain/dates";
import { formatWasteAddress } from "@/domain/waste/address";
import { wasteSyncHealth, type WasteHealth } from "@/domain/waste/health";
import { normalizePickups, WASTE_STREAMS, type WasteStream } from "@/domain/waste/streams";
import type { WasteCalendarRow } from "@/types/database";
import type { HouseholdContext } from "../context";
import { check } from "../errors";
import { HOUSEHOLD_TIMEZONE } from "./scheduling";

export type WasteSettings =
  | {
      role: "admin";
      enabled: false;
    }
  | {
      role: "admin";
      enabled: true;
      address: { postcode: string; houseNumber: number; suffix: string; label: string };
      health: WasteHealth;
      /** Uit de bewaarde stand (≥ vandaag), ook tijdens een storing; null → T-45b */
      next: Record<WasteStream, string | null>;
      openTasks: number;
    }
  | { role: "member"; enabled: boolean; adminNames: string[] };

export async function getWasteSettings(ctx: HouseholdContext, now = new Date()): Promise<WasteSettings> {
  const { supabase, household } = ctx;

  if (!ctx.isAdmin) {
    const [enabled, admins] = await Promise.all([
      supabase.rpc("waste_calendar_enabled").then(check),
      supabase
        .from("household_members")
        .select("display_name")
        .eq("household_id", household.id)
        .eq("role", "admin")
        .eq("is_active", true)
        .order("display_name")
        .then(check),
    ]);
    return {
      role: "member",
      enabled: Boolean(enabled),
      adminNames: (admins as { display_name: string }[]).map((a) => a.display_name),
    };
  }

  const rows = check(await supabase.from("waste_calendars").select("*").eq("household_id", household.id)) as WasteCalendarRow[];
  const cal = rows[0];
  if (!cal) return { role: "admin", enabled: false };

  const tz = household.timezone ?? HOUSEHOLD_TIMEZONE;
  const today = zonedDate(now, tz);
  const pickups = normalizePickups(cal.pickups ?? {});
  const next = { rest: null, papier: null, pmd: null } as Record<WasteStream, string | null>;
  for (const s of WASTE_STREAMS) next[s] = pickups[s].find((d) => d >= today) ?? null;

  // Een mislukte telling geeft een fout (T-68), nooit een onjuiste uitzettekst (code-review WP3b, punt 5)
  const counted = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("household_id", household.id)
    .not("waste_direction", "is", null)
    .in("status", ["todo", "in_progress"]);
  if (counted.error) throw counted.error;
  const count = counted.count ?? 0;

  return {
    role: "admin",
    enabled: true,
    address: {
      postcode: cal.postcode,
      houseNumber: cal.house_number,
      suffix: cal.house_suffix,
      label: formatWasteAddress(cal.postcode, cal.house_number, cal.house_suffix),
    },
    health: wasteSyncHealth(
      {
        last_success_at: cal.last_success_at,
        last_error_code: cal.last_error_code,
        error_since: cal.error_since,
        last_failure_at: cal.last_failure_at,
        alarm_since: cal.alarm_since,
        pickups,
      },
      now,
      tz,
    ),
    next,
    openTasks: count,
  };
}
