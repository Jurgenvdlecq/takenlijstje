"use client";

/** Laatst geladen gegevens per huishouden, zodat de app ook offline iets toont. */
import { createStore, get, set } from "idb-keyval";
import type { Snapshot } from "@/lib/data/snapshot";

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
  if (!store) return;
  try {
    await set(snapshot.household.id, snapshot, store);
  } catch {
    // negeren
  }
}
