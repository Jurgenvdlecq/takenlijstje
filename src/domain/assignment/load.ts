/**
 * Taakbelasting: niet alleen tellen hoeveel taken iemand deed, maar hoe zwaar.
 * 5 minuten = 1 punt, 30 minuten = 3 punten, 60 minuten = 6 punten.
 */
import type { LoadMap } from "./strategies";

export function pointsForDuration(durationMinutes: number | null | undefined): number {
  return Math.max(1, Math.round((durationMinutes ?? 10) / 10));
}

/** Expliciete punten van een taak gaan voor; anders afgeleid van de duur. */
export function taskPoints(task: { points?: number | null; durationMinutes?: number | null }): number {
  return task.points ?? pointsForDuration(task.durationMinutes);
}

export interface LoadEntry {
  memberId: string | null;
  points: number;
}

/** Bouw de belasting op uit afgeronde taken + al toegewezen open taken. */
export function buildLoadMap(entries: LoadEntry[], memberIds: string[]): LoadMap {
  const loads: LoadMap = new Map(memberIds.map((id) => [id, { points: 0, count: 0 }]));
  for (const entry of entries) {
    if (!entry.memberId || !loads.has(entry.memberId)) continue;
    const current = loads.get(entry.memberId)!;
    loads.set(entry.memberId, { points: current.points + entry.points, count: current.count + 1 });
  }
  return loads;
}
