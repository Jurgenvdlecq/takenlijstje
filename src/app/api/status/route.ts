import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";

/**
 * Controle na deployen: welke instellingen ziet de server?
 * Toont nooit geheime waarden, alleen of ze aanwezig zijn.
 */
export function GET() {
  let supabaseHost: string | null = null;
  try {
    supabaseHost = publicEnv.supabaseUrl ? new URL(publicEnv.supabaseUrl).host : null;
  } catch {
    supabaseHost = "ONGELDIGE URL";
  }
  return NextResponse.json({
    versie: (process.env.VERCEL_GIT_COMMIT_SHA ?? "lokaal").slice(0, 7),
    supabaseUrl: supabaseHost ?? "ONTBREEKT",
    supabaseAnonKey: publicEnv.supabaseAnonKey ? `aanwezig (${publicEnv.supabaseAnonKey.length} tekens)` : "ONTBREEKT",
    supabaseServiceRoleKey: serverEnv.serviceRoleKey ? "aanwezig" : "ONTBREEKT",
    siteUrl: publicEnv.siteUrl,
    pushmeldingen: publicEnv.vapidPublicKey && serverEnv.vapidPrivateKey ? "aanwezig" : "ONTBREEKT",
    cronSecret: serverEnv.cronSecret ? "aanwezig" : "ONTBREEKT",
  });
}
