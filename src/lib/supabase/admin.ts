import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { Database } from "@/types/database";
import type { DbClient } from "./server";

/**
 * Client met service role: omzeilt RLS. Alleen gebruiken voor achtergrondtaken
 * (cron, pushmeldingen versturen) en altijd zelf filteren op household_id.
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
