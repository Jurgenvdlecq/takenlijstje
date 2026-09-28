import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";
import type { DbClient } from "@/lib/supabase/server";

/**
 * Client met service role: omzeilt RLS. Mag ALLEEN binnen src/server/system/**
 * worden gebruikt (afgedwongen met ESLint), voor systeemhandelingen: planning
 * invoegen, de tick, meldingen versturen en een auth-account verwijderen.
 * Nooit voor een update of delete die een gebruiker aanvraagt, en nooit om
 * rechten te beslissen (TECHNICAL_DESIGN §5.3). Filter altijd op household_id.
 */
/** De systeemsleutel wordt alleen hier gelezen (ESLint verbiedt het elders) */
function serviceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function createAdminClient(): DbClient {
  const key = serviceRoleKey();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ontbreekt");
  }
  return createClient<Database>(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasAdminClient(): boolean {
  return Boolean(serviceRoleKey() && publicEnv.supabaseUrl);
}
