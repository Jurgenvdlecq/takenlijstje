/**
 * Directe databasetoegang voor E2E-controles ("er is niets veranderd") en voor
 * het klaarzetten van een situatie (bijv. een lid uitzetten), met de
 * service-role-sleutel van de LOKALE teststack. Nooit tegen productie.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import type { Database } from "../../../src/types/database";

let client: SupabaseClient<Database> | null = null;

export function adminDb(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Zet SUPABASE_SERVICE_ROLE_KEY (lokale teststack) voor deze E2E-tests.");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`Weiger E2E-databasetoegang buiten de lokale stack: ${url}`);
  }
  client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function must<T>(result: { data: T | null; error: unknown }, label: string): T {
  if (result.error) throw new Error(`${label}: ${JSON.stringify(result.error)}`);
  if (result.data === null) throw new Error(`${label}: geen data`);
  return result.data;
}

export async function familie() {
  const db = adminDb();
  const household = must(await db.from("households").select("id").eq("name", "Familie").order("created_at", { ascending: false }).limit(1).single(), "huishouden");
  const members = must(await db.from("household_members").select("id, display_name, email, is_active, role").eq("household_id", household.id), "leden");
  const lid = (naam: string) => {
    const m = members.find((x) => x.display_name === naam);
    if (!m) throw new Error(`lid ${naam} ontbreekt`);
    return m;
  };
  return { householdId: household.id, lid };
}

export async function setActive(memberId: string, active: boolean) {
  must(await adminDb().from("household_members").update({ is_active: active }).eq("id", memberId).select("id").single(), "is_active");
}

export async function completionCount(taskId: string): Promise<number> {
  const { count, error } = await adminDb().from("task_completions").select("id", { count: "exact", head: true }).eq("task_id", taskId);
  if (error) throw new Error(JSON.stringify(error));
  return count ?? 0;
}

/** Losse, open taak voor één test (unieke titel), gemaakt door het opgegeven lid */
export async function createLooseTask(householdId: string, createdBy: string, title: string, scheduledDate: string) {
  return must(
    await adminDb()
      .from("tasks")
      .insert({ household_id: householdId, title, scheduled_date: scheduledDate, created_by_member_id: createdBy })
      .select("id, title")
      .single(),
    "taak",
  );
}

export function todayAmsterdam(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(d);
}

/** Inhoud van de IndexedDB-stores van de app (offline-cache en wachtrij) */
export async function readAppIdb(page: Page): Promise<{ cache: number; outbox: unknown[] }> {
  return page.evaluate(async () => {
    function read(dbName: string, storeName: string): Promise<{ keys: number; entries: unknown }> {
      return new Promise((resolve) => {
        const req = indexedDB.open(dbName);
        req.onupgradeneeded = () => req.result.createObjectStore(storeName);
        req.onerror = () => resolve({ keys: 0, entries: undefined });
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            resolve({ keys: 0, entries: undefined });
            return;
          }
          const tx = db.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const countReq = store.count();
          const getReq = store.get("entries");
          tx.oncomplete = () => {
            db.close();
            resolve({ keys: countReq.result, entries: getReq.result });
          };
        };
      });
    }
    const cache = await read("takenlijstje-cache", "snapshots");
    const outbox = await read("takenlijstje-outbox", "outbox");
    return { cache: cache.keys, outbox: (outbox.entries as unknown[]) ?? [] };
  });
}

/** Zet wachtrij-entries in IndexedDB, zoals een oudere app-versie ze achterliet */
export async function writeOutboxIdb(page: Page, entries: unknown[]) {
  await page.evaluate(async (value) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("takenlijstje-outbox");
      req.onupgradeneeded = () => req.result.createObjectStore("outbox");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("outbox", "readwrite");
        tx.objectStore("outbox").put(value, "entries");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, entries);
}
