"use client";

/** Laatst geladen gegevens per huishouden, zodat de app ook offline iets toont. */
import { clear, createStore, get, set } from "idb-keyval";
import type { Snapshot } from "@/lib/data/snapshot";

let locked = false;
const store = typeof indexedDB !== "undefined" ? createStore("takenlijstje-cache", "snapshots") : null;

export async function readCachedSnapshot(householdId: string): Promise<Snapshot | null> {
  if (!store) return null;
  try {
    return (await get<Snapshot>(householdId, store)) ?? null;
  } catch {
    return null;
  }
}

export async function writeCachedSnapshot(snapshot: Snapshot): Promise<void> {
  if (!store || locked) return;
  try {
    await set(snapshot.household.id, snapshot, store);
  } catch {
    // negeren
  }
}

/** Alles wissen (uitloggen, uitgezet of niet meer lid; BR-43) */
export async function clearCachedSnapshots(): Promise<void> {
  // Na het wissen (uitloggen) mag een nog lopende timer niets meer terugschrijven
  locked = true;
  if (!store) return;
  try {
    await clear(store);
  } catch {
    // negeren: het vangnet bij opstarten ruimt alsnog op
  }
}
