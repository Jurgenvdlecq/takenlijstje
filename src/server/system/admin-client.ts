import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { Database } from "@/types/database";
import type { DbClient } from "@/lib/supabase/server";

/**
 * Client met service role: omzeilt RLS. Mag ALLEEN binnen src/server/system/**
 * worden gebruikt (afgedwongen met ESLint), voor systeemhandelingen: planning
 * invoegen, de tick, meldingen versturen en een auth-account verwijderen.
 * Nooit voor een update of delete die een gebruiker aanvraagt, en nooit om
 * rechten te beslissen (TECHNICAL_DESIGN §5.3). Filter altijd op household_id.
 */
export function createAdminClient(): DbClient {
  if (!serverEnv.serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ontbreekt");
  }
  return createClient<Database>(publicEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasAdminClient(): boolean {
  return Boolean(serverEnv.serviceRoleKey && publicEnv.supabaseUrl);
}
