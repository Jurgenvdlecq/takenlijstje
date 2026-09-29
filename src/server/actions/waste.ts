"use server";

/**
 * Afvalkalender instellen (TECHNICAL_DESIGN §18.6). Alleen beheerders, online.
 * Vaste volgorde: requireAdmin() → zod → pas dan een opvraging of schrijfactie.
 * Uitkomsten van de bron zijn `kind`-waarden, geen fouten. Naar de browser gaan
 * nooit de adrescode of ruwe datums (bevestigen vraagt opnieuw op).
 */
import { z } from "zod";
import { normalizeWasteAddress } from "@/domain/waste/address";
import type { WasteHealth } from "@/domain/waste/health";
import { WASTE_TEXT } from "@/domain/waste/messages";
import type { WasteCalendarRow } from "@/types/database";
import { requireAdmin, requireMember } from "../context";
import { check, runAction, UserError, type ActionResult } from "../errors";
import { HOUSEHOLD_TIMEZONE } from "../services/scheduling";
import { getWasteSettings, type WasteSettings } from "../services/waste-read";
import {
  allowWasteLookup,
  applyConfirmedSameAddress,
  claimForRetry,
  saveWasteCalendar,
  syncHousehold,
  WASTE_FETCH_BUDGET_MS,
} from "../system/waste/sync";
import { lookupWasteCalendar, type NextPickups, type WasteLookup } from "../waste/lookup";

const addressInput = z.object({
  postcode: z.string().max(10),
  houseNumber: z.string().max(12),
  suffix: z.string().max(8).nullable(),
});
export type WasteAddressInput = z.input<typeof addressInput>;

/** Wat de browser van een opzoeking te zien krijgt (zonder adrescode of datums-lijst) */
export type WasteLookupResult =
  | { kind: "found"; display: string; next: NextPickups; suffix: string }
  | { kind: "choose"; houseNumber: number; candidates: { suffix: string; display: string }[] }
  | { kind: "not_found" }
  | { kind: "no_streams" }
  | { kind: "no_upcoming" }
  | { kind: "unreachable" };

export type WasteConfirmResult =
  | { kind: "saved"; mode: "enabled" | "changed" | "unchanged"; inserted: number; removed: number }
  | Exclude<WasteLookupResult, { kind: "found" }>;

function parseAddress(raw: unknown) {
  const input = addressInput.safeParse(raw);
  if (!input.success) {
    const field = input.error.issues[0]?.path[0];
    throw new UserError(
      field === "postcode" ? WASTE_TEXT.postcodeError : field === "suffix" ? WASTE_TEXT.suffixError : WASTE_TEXT.houseNumberError,
      "VALIDATION",
    );
  }
  const normalized = normalizeWasteAddress(input.data);
  if (!normalized.ok) {
    const e = normalized.errors;
    throw new UserError(
      e.postcode ? WASTE_TEXT.postcodeError : e.houseNumber ? WASTE_TEXT.houseNumberError : WASTE_TEXT.suffixError,
      "VALIDATION",
    );
  }
  return normalized.address;
}

async function lookup(householdId: string, address: ReturnType<typeof parseAddress>, now: Date): Promise<WasteLookup> {
  // Boven de grens: de bestaande uitkomst "nu niet bereikbaar" (T-63), niets bewaard (V-59, D-049)
  if (!(await allowWasteLookup(householdId, now))) return { kind: "unreachable" };
  return lookupWasteCalendar(address, now, HOUSEHOLD_TIMEZONE, { signal: AbortSignal.timeout(WASTE_FETCH_BUDGET_MS) });
}

function forBrowser(result: WasteLookup): WasteLookupResult {
  if (result.kind === "found") return { kind: "found", display: result.display, next: result.next, suffix: result.suffix };
  return result;
}

export async function getWasteSettingsAction(): Promise<ActionResult<WasteSettings>> {
  return runAction("getWasteSettings", async () => getWasteSettings(await requireMember()));
}

/** Opzoeken. Schrijft niets. */
export async function lookupWasteAddressAction(raw: WasteAddressInput): Promise<ActionResult<WasteLookupResult>> {
  return runAction("lookupWasteAddress", async () => {
    const ctx = await requireAdmin();
    const address = parseAddress(raw);
    return forBrowser(await lookup(ctx.household.id, address, new Date()));
  });
}

/** Bevestigen: vraagt opnieuw op en bewaart alleen bij `found` (BR-48). */
export async function confirmWasteAddressAction(raw: WasteAddressInput): Promise<ActionResult<WasteConfirmResult>> {
  return runAction("confirmWasteAddress", async () => {
    const ctx = await requireAdmin();
    const address = parseAddress(raw);
    const now = new Date();
    const result = await lookup(ctx.household.id, address, now);
    if (result.kind !== "found") return forBrowser(result) as WasteConfirmResult;

    const rows = check(
      await ctx.supabase.from("waste_calendars").select("*").eq("household_id", ctx.household.id),
    ) as WasteCalendarRow[];
    const current = rows[0];
    const same =
      current &&
      current.bag_id === result.bagId &&
      current.postcode === address.postcode &&
      current.house_number === address.houseNumber &&
      current.house_suffix === result.suffix;

    if (same) {
      // (c) Zelfde adres: stand bijwerken, zonder claim (nooit T-79, AC-222)
      const counts = await applyConfirmedSameAddress(ctx.household.id, ctx.member.id, current.version, result.pickups, now);
      if (counts.stale) throw new UserError(WASTE_TEXT.saveFailed, "UNKNOWN");
      return { kind: "saved", mode: "unchanged", inserted: counts.inserted, removed: counts.removed };
    }

    // (a) aanzetten of (b) ander adres (BR-56)
    const saved = await saveWasteCalendar({
      householdId: ctx.household.id,
      memberId: ctx.member.id,
      postcode: address.postcode,
      houseNumber: address.houseNumber,
      suffix: result.suffix,
      bagId: result.bagId,
      pickups: result.pickups,
      now,
    });
    return { kind: "saved", mode: current ? "changed" : "enabled", inserted: saved.inserted, removed: saved.removed };
  });
}

export type WasteRetryResult =
  | { kind: "done"; health: WasteHealth; lastSuccessAt: string; attemptedAt: string }
  | { kind: "too_soon" };

/** "Opnieuw proberen": hooguit één opvraging per minuut (claim ≥ 60 s) */
export async function retryWasteSyncAction(): Promise<ActionResult<WasteRetryResult>> {
  return runAction("retryWasteSync", async () => {
    const ctx = await requireAdmin();
    const now = new Date();
    if (!(await claimForRetry(ctx.household.id, now))) return { kind: "too_soon" as const };
    const synced = await syncHousehold(ctx.household.id, ctx.member.id, now, { signal: AbortSignal.timeout(WASTE_FETCH_BUDGET_MS) });
    if (!synced) throw new UserError(WASTE_TEXT.saveFailed, "UNKNOWN");
    return { kind: "done" as const, health: synced.health, lastSuccessAt: synced.health.lastSuccessAt, attemptedAt: synced.attemptedAt };
  });
}

/** Uitzetten: adres en open afvaltaken weg (BR-56, AC-213) */
export async function disableWasteCalendarAction(): Promise<ActionResult<{ removed: number }>> {
  return runAction("disableWasteCalendar", async () => {
    const ctx = await requireAdmin();
    const removed = check(await ctx.supabase.rpc("disable_waste_calendar")) as number;
    return { removed };
  });
}
