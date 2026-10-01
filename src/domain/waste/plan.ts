/**
 * Afvaltaken plannen (W-03, BR-49…BR-51; TECHNICAL_DESIGN §18.4, §18.8.2,
 * §18.8.4). Puur: uit de opgehaalde ophaaldagen en de bestaande afvaltaken volgt
 * wat er bij moet, hernoemd moet worden en weg moet. Het toepassen gebeurt
 * atomisch in de RPC's waste_save / waste_sync.
 */
import { addDays, todayIn, zonedInstant, type ISODate } from "../dates";
import { WASTE_IN_DESCRIPTION, WASTE_OUT_DESCRIPTION, type WasteDirection } from "./messages";
import { sortStreams, WASTE_STREAMS, type WasteStream } from "./streams";

export const WASTE_HORIZON_DAYS = 14;
const DIRECTIONS: WasteDirection[] = ["out", "in"];

export type WastePickups = Record<WasteStream, ISODate[]>;

export function emptyPickups(): WastePickups {
  return { rest: [], papier: [], pmd: [] };
}

export function isWasteTask(task: { waste_direction?: string | null }): boolean {
  return task.waste_direction != null;
}

const OUT_WORD: Record<WasteStream, string> = { rest: "restafval", papier: "papier", pmd: "PMD" };
const IN_PART: Record<WasteStream, string> = { rest: "restafval-", papier: "papier-", pmd: "PMD-" };
const IN_LAST: Record<WasteStream, string> = { rest: "restafvalbak", papier: "papierbak", pmd: "PMD-bak" };

function joinDutch(parts: string[]): string {
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} en ${parts.at(-1)}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Exacte taaknaam volgens UX_SPEC §13.3 */
export function wasteTitle(streams: Iterable<string>, direction: WasteDirection): string {
  const sorted = sortStreams(streams);
  if (!sorted.length) throw new Error("Een afvaltaak heeft minstens één bak");
  if (direction === "out") return `${capitalize(joinDutch(sorted.map((s) => OUT_WORD[s])))} buitenzetten`;
  const parts = sorted.map((s, i) => (i === sorted.length - 1 ? IN_LAST[s] : IN_PART[s]));
  return `${capitalize(joinDutch(parts))} binnenzetten`;
}

export interface WasteTaskFields {
  title: string;
  description: string;
  scheduled_date: ISODate;
  scheduled_time: string | null;
  available_from: string | null;
  due_at: string;
  waste_pickup_date: ISODate;
  waste_direction: WasteDirection;
  waste_streams: WasteStream[];
}

/** Velden van een afvaltaak (§18.4.2); tijden in de tijdzone van het huishouden (BR-59) */
export function wasteTaskFields(pickupDate: ISODate, direction: WasteDirection, streams: Iterable<string>, timeZone: string): WasteTaskFields {
  const sorted = sortStreams(streams);
  const title = wasteTitle(sorted, direction);
  if (direction === "out") {
    return {
      title,
      description: WASTE_OUT_DESCRIPTION,
      scheduled_date: addDays(pickupDate, -1),
      scheduled_time: "21:00",
      available_from: null,
      due_at: zonedInstant(pickupDate, "07:45", timeZone),
      waste_pickup_date: pickupDate,
      waste_direction: direction,
      waste_streams: sorted,
    };
  }
  return {
    title,
    description: WASTE_IN_DESCRIPTION,
    scheduled_date: pickupDate,
    scheduled_time: null,
    available_from: zonedInstant(pickupDate, "12:00", timeZone),
    due_at: zonedInstant(addDays(pickupDate, 1), "00:00", timeZone),
    waste_pickup_date: pickupDate,
    waste_direction: direction,
    waste_streams: sorted,
  };
}

/** Alleen datums vanaf vandaag, gesorteerd en uniek, per bak */
export function futurePickups(pickups: Partial<WastePickups>, today: ISODate): WastePickups {
  const out = emptyPickups();
  for (const stream of WASTE_STREAMS) {
    out[stream] = [...new Set((pickups[stream] ?? []).filter((d) => d >= today))].sort();
  }
  return out;
}

/** Eerstvolgende ophaaldag per bak (voor "Klopt dit?" en de status) */
export function nextPickups(pickups: Partial<WastePickups>, today: ISODate): Record<WasteStream, ISODate | null> {
  const future = futurePickups(pickups, today);
  return { rest: future.rest[0] ?? null, papier: future.papier[0] ?? null, pmd: future.pmd[0] ?? null };
}

/** Bakken per ophaaldag binnen [from, to] */
export function streamsByDate(pickups: Partial<WastePickups>, from: ISODate, to: ISODate): Map<ISODate, WasteStream[]> {
  const byDate = new Map<ISODate, Set<WasteStream>>();
  for (const stream of WASTE_STREAMS) {
    for (const date of pickups[stream] ?? []) {
      if (date < from || date > to) continue;
      byDate.set(date, (byDate.get(date) ?? new Set()).add(stream));
    }
  }
  return new Map([...byDate.entries()].map(([d, s]) => [d, sortStreams(s)]));
}

/** BR-52: geen enkele datum van rest, papier of PMD samen in [vandaag, vandaag + 14] */
export function isSuspectEmpty(pickups: Partial<WastePickups>, today: ISODate): boolean {
  return streamsByDate(pickups, today, addDays(today, WASTE_HORIZON_DAYS)).size === 0;
}

export interface ExistingWasteTask {
  id: string;
  status: "todo" | "in_progress" | "done" | "skipped";
  waste_pickup_date: ISODate;
  waste_direction: WasteDirection;
  waste_streams: string[];
}

export interface WastePlan {
  insert: WasteTaskFields[];
  rename: { id: string; title: string; waste_streams: WasteStream[] }[];
  remove: string[];
}

function isOpen(task: { status: string }): boolean {
  return task.status === "todo" || task.status === "in_progress";
}

function sameStreams(a: string[], b: string[]): boolean {
  const x = sortStreams(a);
  const y = sortStreams(b);
  return x.length === y.length && x.every((s, i) => s === y[i]);
}

/**
 * Wat er moet gebeuren (§18.8.2):
 *  - insert: een gewenste (dag, richting) zonder bestaande taak (elke status telt),
 *    buitenzetten alleen zolang het nog vóór D 07:45 is (AC-203);
 *  - rename: een open taak waarvan de bakken veranderden (AC-201);
 *  - remove: een open taak in het venster zonder ophaling meer op D, behalve
 *    binnenzetten als buitenzetten van die dag al gedaan is (AC-198…AC-200).
 * Taken van vóór vandaag worden hier nooit geraakt (BR-54 regelt die).
 */
export function planWasteTasks(input: {
  pickups: Partial<WastePickups>;
  existing: ExistingWasteTask[];
  now: Date;
  timeZone: string;
}): WastePlan {
  const { pickups, existing, now, timeZone } = input;
  const today = todayIn(timeZone, now);
  const end = addDays(today, WASTE_HORIZON_DAYS);
  const desired = streamsByDate(pickups, today, end);
  const byKey = new Map(existing.map((t) => [`${t.waste_pickup_date}|${t.waste_direction}`, t]));
  const plan: WastePlan = { insert: [], rename: [], remove: [] };

  for (const [date, streams] of [...desired.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    for (const direction of DIRECTIONS) {
      const current = byKey.get(`${date}|${direction}`);
      if (!current) {
        if (direction === "out" && now.getTime() >= new Date(zonedInstant(date, "07:45", timeZone)).getTime()) continue;
        plan.insert.push(wasteTaskFields(date, direction, streams, timeZone));
      } else if (isOpen(current) && !sameStreams(current.waste_streams, streams)) {
        plan.rename.push({ id: current.id, title: wasteTitle(streams, direction), waste_streams: streams });
      }
    }
  }

  for (const task of existing) {
    const date = task.waste_pickup_date;
    if (date < today || date > end || !isOpen(task) || desired.has(date)) continue;
    if (task.waste_direction === "in" && byKey.get(`${date}|out`)?.status === "done") continue;
    plan.remove.push(task.id);
  }
  return plan;
}

export function isEmptyPlan(plan: WastePlan): boolean {
  return !plan.insert.length && !plan.rename.length && !plan.remove.length;
}
