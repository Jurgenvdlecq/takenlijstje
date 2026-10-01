"use server";

/**
 * Server actions van de afvalkalender (W-03; TECHNICAL_DESIGN §18.6). Vast patroon
 * (§5.1): runAction → requireAdmin → zod → pas daarna een opvraging of schrijfactie.
 * Een gezinslid of uitgezet lid krijgt FORBIDDEN zonder dat er iets bij de
 * gemeente wordt opgevraagd (AC-189). De client levert nooit een adrescode of
 * datums aan: bij bevestigen vraagt de server alles opnieuw op.
 */
import { z } from "zod";
import { todayIn, type ISODate } from "@/domain/dates";
import { normalizeWasteAddress, type WasteAddress } from "@/domain/waste/address";
import type { WasteHealth } from "@/domain/waste/health";
import type { WasteStream } from "@/domain/waste/streams";
import { requireAdmin, requireMember } from "../context";
import { check, runAction, UserError, type ActionResult } from "../errors";
import { parse } from "../parse";
import { confirmWasteCalendar, retryWasteSync } from "../system/waste/sync";
import { lookupWasteCalendar, type LookupOutcome } from "../waste/lookup";
import { getWasteSettings, type WasteSettings } from "../waste/read";
import { createSourceDeps } from "../waste/source";

const addressInput = z.object({
  postcode: z.string().max(12),
  houseNumber: z.union([z.string().max(12), z.number()]),
  /** null = niet opgegeven; "" = bewust zonder letter of toevoeging */
  suffix: z.string().max(8).nullable(),
});

export type WasteAddressInput = z.input<typeof addressInput>;

/** Wat de beheerder terugkrijgt: nooit de adrescode of de ruwe datums */
export type WasteLookupResult =
  | {
      kind: "found";
      address: { postcode: string; houseNumber: number; suffix: string };
      display: string;
      next: Record<WasteStream, ISODate | null>;
    }
  | Exclude<LookupOutcome, { kind: "found" }>;

function toAddress(raw: WasteAddressInput): WasteAddress {
  const input = parse(addressInput, raw);
  const result = normalizeWasteAddress(input);
  if (!result.ok) throw new UserError(result.message, "VALIDATION");
  return result.value;
}

function toClient(outcome: LookupOutcome): WasteLookupResult {
  if (outcome.kind !== "found") return outcome;
  return { kind: "found", address: outcome.address, display: outcome.display, next: outcome.next };
}

export async function getWasteSettingsAction(): Promise<ActionResult<WasteSettings>> {
  return runAction("getWasteSettings", async () => getWasteSettings(await requireMember()));
}

export async function lookupWasteAddressAction(raw: WasteAddressInput): Promise<ActionResult<WasteLookupResult>> {
  return runAction("lookupWasteAddress", async () => {
    const { household } = await requireAdmin();
    const address = toAddress(raw);
    return toClient(await lookupWasteCalendar(address, todayIn(household.timezone), createSourceDeps()));
  });
}

export async function confirmWasteAddressAction(
  raw: WasteAddressInput,
): Promise<ActionResult<{ kind: "saved"; inserted: number; removed: number } | WasteLookupResult>> {
  return runAction("confirmWasteAddress", async () => {
    const { household, member } = await requireAdmin();
    const address = toAddress(raw);
    const outcome = await lookupWasteCalendar(address, todayIn(household.timezone), createSourceDeps());
    if (outcome.kind !== "found") return toClient(outcome);
    const saved = await confirmWasteCalendar(household.id, member.id, outcome);
    return { kind: "saved" as const, ...saved };
  });
}

export async function retryWasteSyncAction(): Promise<
  ActionResult<{ kind: "done"; health: WasteHealth; lastSuccessAt: string } | { kind: "too_soon" } | { kind: "disabled" }>
> {
  return runAction("retryWasteSync", async () => {
    const { household } = await requireAdmin();
    return retryWasteSync(household.id);
  });
}

export async function disableWasteCalendarAction(): Promise<ActionResult<{ removed: number }>> {
  return runAction("disableWasteCalendar", async () => {
    const { supabase } = await requireAdmin();
    const removed = check(await supabase.rpc("disable_waste_calendar")) as number;
    return { removed };
  });
}
