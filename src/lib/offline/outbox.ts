"use client";

/**
 * Offline wachtrij. Acties die niet konden worden verstuurd (geen internet)
 * worden in IndexedDB bewaard en automatisch verstuurd zodra de verbinding
 * terugkomt. Iedere actie draagt een eigen id, zodat de server hem bij
 * opnieuw versturen herkent (geen dubbele registratie).
 */
import { clear, createStore, get, set } from "idb-keyval";

export interface OutboxEntry<P = unknown> {
  id: string;
  /** Versie van het wachtrijformaat; ontbreekt bij entries van vóór WP1 (= versie 0) */
  v?: number;
  kind: string;
  payload: P;
  createdAt: string;
  attempts: number;
}

// Eén database per store: idb-keyval ondersteunt geen meerdere stores per database
const store = typeof indexedDB !== "undefined" ? createStore("takenlijstje-outbox", "outbox") : null;
const KEY = "entries";

export async function readOutbox(): Promise<OutboxEntry[]> {
  if (!store) return [];
  try {
    return (await get<OutboxEntry[]>(KEY, store)) ?? [];
  } catch {
    return [];
  }
}

export async function writeOutbox(entries: OutboxEntry[]): Promise<void> {
  if (!store) return;
  try {
    await set(KEY, entries, store);
  } catch {
    // Opslag vol of geblokkeerd: niet fataal
  }
}

/** Is dit een netwerkfout (offline), en geen fout van de server zelf? */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
}

/** Alles wissen (uitloggen, uitgezet of niet meer lid; BR-43) */
export async function clearOutbox(): Promise<void> {
  if (!store) return;
  try {
    await clear(store);
  } catch {
    // negeren: het vangnet bij opstarten ruimt alsnog op
  }
}
