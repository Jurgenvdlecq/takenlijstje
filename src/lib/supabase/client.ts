"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

/** Eén gedeelde client in de browser (voor lezen + realtime; RLS beschermt). */
export function getBrowserClient(): SupabaseClient<Database> {
  browserClient ??= createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return browserClient;
}
