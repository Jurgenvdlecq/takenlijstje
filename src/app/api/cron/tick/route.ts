import { NextResponse, type NextRequest } from "next/server";
import { hasCronSecret } from "@/server/cron-auth";
import { runTick } from "@/server/system/tick";

export const dynamic = "force-dynamic";
/** De tick stopt na 45 s met pushen (§11.3); de functie krijgt ruim de tijd */
export const maxDuration = 60;

/**
 * Aanroepen elke 15 minuten via Supabase Cron (pg_cron + pg_net, zie
 * supabase/ops/planner.sql) en 1×/dag als vangnet via Vercel Cron, met de
 * header "Authorization: Bearer $CRON_SECRET". Antwoord: alleen tellingen.
 */
async function handle(request: NextRequest) {
  if (!hasCronSecret(request)) {
    return NextResponse.json({ error: "Niet toegestaan" }, { status: 401 });
  }
  const report = await runTick();
  // Faalde een stap, dan geen 200: zo is een storing zichtbaar in de planner
  // (net._http_response) en in AC-063. De body blijft alleen tellingen (D-040).
  return NextResponse.json(report, { status: report.failed.length ? 500 : 200 });
}

export const GET = handle;
export const POST = handle;
