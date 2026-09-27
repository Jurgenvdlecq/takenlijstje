import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { assertSupabaseConfigured, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export type DbClient = SupabaseClient<Database>;

/** Supabase-client met de sessie van de ingelogde gebruiker (RLS actief). */
export async function createClient(): Promise<DbClient> {
  assertSupabaseConfigured();
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Aangeroepen vanuit een Server Component: de proxy ververst de sessie al.
        }
      },
    },
  });
}
