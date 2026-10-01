import "server-only";

/**
 * Wat de instellingenpagina over de afvalkalender laat zien (TECHNICAL_DESIGN
 * §18.6, UX_SPEC §13.8). Met de gebruikersclient: een beheerder leest de rij via
 * RLS; een gezinslid krijgt alleen aan/uit (V-53).
 */
import { todayIn, type ISODate } from "@/domain/dates";
import { wasteSyncHealth, type WasteHealth } from "@/domain/waste/health";
import { nextPickups } from "@/domain/waste/plan";
import type { WasteStream } from "@/domain/waste/streams";
import type { HouseholdContext } from "../context";
import { check } from "../errors";

export type WasteSettings =
  | { role: "member"; enabled: boolean }
  | { role: "admin"; enabled: false }
  | {
      role: "admin";
      enabled: true;
      postcode: string;
      houseNumber: number;
      suffix: string;
      lastSuccessAt: string;
      health: WasteHealth;
      next: Record<WasteStream, ISODate | null>;
    };

export async function getWasteSettings(ctx: HouseholdContext, now = new Date()): Promise<WasteSettings> {
  if (!ctx.isAdmin) {
    const enabled = check(await ctx.supabase.rpc("waste_calendar_enabled")) as boolean;
    return { role: "member", enabled: Boolean(enabled) };
  }
  const rows = check(
    await ctx.supabase.from("waste_calendars").select("*").eq("household_id", ctx.household.id).limit(1),
  );
  const row = rows[0];
  if (!row) return { role: "admin", enabled: false };
  return {
    role: "admin",
    enabled: true,
    postcode: row.postcode,
    houseNumber: row.house_number,
    suffix: row.house_suffix,
    lastSuccessAt: row.last_success_at,
    health: wasteSyncHealth(row, now),
    next: nextPickups(row.pickups, todayIn(ctx.household.timezone, now)),
  };
}
