/**
 * Afvaltaken plannen (TECHNICAL_DESIGN §18.4, §18.8.2, §18.8.4). Puur.
 * Toepassen gebeurt atomisch in de RPC waste_save of waste_sync.
 */
import { addDays, diffDays, parts, zonedDate, zonedInstant, type ISODate } from "@/domain/dates";
import { wasteTitle, type WasteDirection } from "./messages";
import { sortStreams, WASTE_STREAMS, type WastePickups, type WasteStream } from "./streams";

/** Taken staan 14 dagen vooraf klaar (V-52) */
export const WASTE_HORIZON_DAYS = 14;
/** Grootste verschuiving die als "dezelfde ophaling" telt (notities blijven) */
export const MAX_SHIFT_DAYS = 3;

export const WASTE_OUT_FROM = "22:00";
export const WASTE_OUT_DEADLINE = "07:45";
export const WASTE_IN_FROM = "12:00";
export const WASTE_IN_REMINDER = "18:00";
export const WASTE_OUT_REMINDER = "21:00";

/** Velden van een afvaltaak zoals de RPC ze verwacht (jsonb) */
export interface WasteTaskFields {
  title: string;
  scheduled_date: ISODate;
  scheduled_time: string | null;
  available_from: string | null;
  due_at: string;
  waste_pickup_date: ISODate;
  waste_direction: WasteDirection;
  waste_streams: WasteStream[];
}

/** §18.4.2: buiten op D−1 (sorteren op 21:00), binnen op D vanaf 12:00 */
export function wasteTaskFields(
  pickupDate: ISODate,
  direction: WasteDirection,
  streams: WasteStream[],
  timeZone: string,
): WasteTaskFields {
  const sorted = sortStreams(streams);
  if (direction === "out") {
    return {
      title: wasteTitle(sorted, "out"),
      scheduled_date: addDays(pickupDate, -1),
      scheduled_time: WASTE_OUT_REMINDER,
      available_from: null,
      due_at: zonedInstant(pickupDate, WASTE_OUT_DEADLINE, timeZone),
      waste_pickup_date: pickupDate,
      waste_direction: "out",
      waste_streams: sorted,
    };
  }
  return {
    title: wasteTitle(sorted, "in"),
    scheduled_date: pickupDate,
    scheduled_time: null,
    available_from: zonedInstant(pickupDate, WASTE_IN_FROM, timeZone),
    due_at: zonedInstant(addDays(pickupDate, 1), "00:00", timeZone),
    waste_pickup_date: pickupDate,
    waste_direction: "in",
    waste_streams: sorted,
  };
}

export type WasteTaskStatus = "todo" | "in_progress" | "done" | "skipped";

export interface ExistingWasteTask {
  id: string;
  pickupDate: ISODate;
  direction: WasteDirection;
  streams: WasteStream[];
  status: WasteTaskStatus;
}

export interface WasteMove extends WasteTaskFields {
  id: string;
  direction: WasteDirection;
}

export interface WastePlan {
  insert: WasteTaskFields[];
  move: WasteMove[];
  rename: { id: string; title: string; waste_streams: WasteStream[] }[];
  remove: string[];
}

export function isEmptyPlan(plan: WastePlan): boolean {
  return !plan.insert.length && !plan.move.length && !plan.rename.length && !plan.remove.length;
}

const isOpen = (t: { status: WasteTaskStatus }) => t.status === "todo" || t.status === "in_progress";
const key = (date: ISODate, direction: WasteDirection) => `${date}|${direction}`;
const DIRECTIONS: WasteDirection[] = ["out", "in"];

/** Bakken per ophaaldag, voor de dagen in [from, to] */
export function pickupsByDay(pickups: WastePickups, from: ISODate, to: ISODate): Map<ISODate, WasteStream[]> {
  const days = new Map<ISODate, WasteStream[]>();
  for (const stream of WASTE_STREAMS) {
    for (const date of pickups[stream] ?? []) {
      if (date < from || date > to) continue;
      days.set(date, [...(days.get(date) ?? []), stream]);
    }
  }
  for (const [date, streams] of days) days.set(date, sortStreams(streams));
  return days;
}

/**
 * §18.8.2. `existing` = alle afvaltaken van het huishouden met ophaaldag
 * ≥ vandaag (elke status). Taken met een ophaaldag vóór vandaag raakt dit nooit.
 */
export function planWasteTasks(input: {
  pickups: WastePickups;
  existing: ExistingWasteTask[];
  now: Date;
  timeZone: string;
}): WastePlan {
  const { pickups, now, timeZone } = input;
  const today = zonedDate(now, timeZone);
  const horizon = addDays(today, WASTE_HORIZON_DAYS);
  const existing = input.existing.filter((t) => t.pickupDate >= today);

  // 1–2. Venster en gewenste sleutels
  const desired = pickupsByDay(pickups, today, horizon);
  const byKey = new Map(existing.map((t) => [key(t.pickupDate, t.direction), t]));

  // 3. Invoegbaar: gewenst, nog geen taak (elke status), en het moment is nog niet voorbij
  const insertable = new Set<string>();
  for (const date of desired.keys()) {
    for (const direction of DIRECTIONS) {
      if (byKey.has(key(date, direction))) continue;
      if (direction === "out" && now.getTime() >= new Date(zonedInstant(date, WASTE_OUT_DEADLINE, timeZone)).getTime()) continue;
      insertable.add(key(date, direction));
    }
  }

  // 4. Wezen: open taken in het venster op een dag zonder ophaling
  const orphans = existing.filter((t) => {
    if (!isOpen(t) || t.pickupDate > horizon || desired.has(t.pickupDate)) return false;
    // Binnenzetten blijft staan als de bak al buiten stond (BR-51, AC-200)
    if (t.direction === "in" && byKey.get(key(t.pickupDate, "out"))?.status === "done") return false;
    return true;
  });

  const plan: WastePlan = { insert: [], move: [], rename: [], remove: [] };

  // 5. Verschuiving koppelen, per dag
  const orphanDays = [...new Set(orphans.map((t) => t.pickupDate))].sort();
  const newDays = [...desired.keys()]
    .filter((d) => DIRECTIONS.some((dir) => insertable.has(key(d, dir))))
    .sort();
  const coupled = new Set<ISODate>();

  for (const day of orphanDays) {
    const dayOrphans = orphans.filter((t) => t.pickupDate === day);
    const orphanStreams = new Set(dayOrphans.flatMap((t) => t.streams));
    let target: ISODate | null = null;
    let best = Infinity;
    for (const candidate of newDays) {
      if (coupled.has(candidate)) continue;
      const distance = Math.abs(diffDays(day, candidate));
      if (distance > MAX_SHIFT_DAYS) continue;
      if (!desired.get(candidate)!.some((s) => orphanStreams.has(s))) continue;
      if (distance < best) {
        best = distance;
        target = candidate; // bij gelijke afstand blijft de vroegste staan (newDays is gesorteerd)
      }
    }

    if (target === null) {
      // 6. Niet verschoven: weg (AC-199)
      plan.remove.push(...dayOrphans.map((t) => t.id));
      continue;
    }
    coupled.add(target);
    for (const orphan of dayOrphans) {
      const targetKey = key(target, orphan.direction);
      if (insertable.has(targetKey)) {
        plan.move.push({
          id: orphan.id,
          direction: orphan.direction,
          ...wasteTaskFields(target, orphan.direction, desired.get(target)!, timeZone),
        });
        insertable.delete(targetKey);
      } else {
        plan.remove.push(orphan.id);
      }
    }
  }

  // 7. Hernoemen: open taak op een gewenste dag, maar met andere bakken (AC-201)
  for (const task of existing) {
    const streams = desired.get(task.pickupDate);
    if (!streams || !isOpen(task)) continue;
    if (sortStreams(task.streams).join(",") === streams.join(",")) continue;
    plan.rename.push({ id: task.id, title: wasteTitle(streams, task.direction), waste_streams: streams });
  }

  // 8. Invoegen: wat nog invoegbaar is
  for (const date of [...desired.keys()].sort()) {
    for (const direction of DIRECTIONS) {
      if (insertable.has(key(date, direction))) {
        plan.insert.push(wasteTaskFields(date, direction, desired.get(date)!, timeZone));
      }
    }
  }

  return plan;
}

// ---------------------------------------------------------------------------
// "Geen komende ophaaldagen" (§18.8.4)
// ---------------------------------------------------------------------------

/** Geen enkele komende ophaaldag (vandaag of later) voor rest, papier en PMD samen */
export function hasNoUpcoming(pickups: WastePickups, today: ISODate): boolean {
  return WASTE_STREAMS.every((s) => !(pickups[s] ?? []).some((d) => d >= today));
}

export interface FetchedPickups {
  pickups: WastePickups;
  unknownStreams: number;
  /** Minstens één datum van rest/papier/pmd in jaar J, ook in het verleden */
  hadAnyDateInJ: boolean;
  /** C(J+1) is opgehaald zonder fout */
  fetchedNextYear: boolean;
  /** C(J+1) bevat minstens één datum van rest/papier/pmd */
  nextYearHasDate: boolean;
}

export type EmptyClassification =
  | { result: "success"; notice: "next_year_missing" | null }
  | { result: "failure"; code: "SUSPECT_EMPTY" };

/** Uitkomst bij het bijwerken, in de volgorde van §18.8.4 */
export function classifyEmpty(fetched: FetchedPickups, today: ISODate): EmptyClassification {
  if (!hasNoUpcoming(fetched.pickups, today)) return { result: "success", notice: null };
  if (!fetched.hadAnyDateInJ) return { result: "failure", code: "SUSPECT_EMPTY" };
  const { month } = parts(today);
  if ((month === 11 || month === 12) && fetched.fetchedNextYear && !fetched.nextYearHasDate) {
    return { result: "success", notice: "next_year_missing" };
  }
  return { result: "failure", code: "SUSPECT_EMPTY" };
}
