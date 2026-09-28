import { NextResponse, type NextRequest } from "next/server";
import { hasCronSecret } from "@/server/cron-auth";
import { runTick } from "@/server/system/tick";

export const dynamic = "force-dynamic";

/**
 * Aanroepen iedere 15 minuten, bijv. via Supabase pg_cron + pg_net,
 * Vercel Cron of cron-job.org, met header "Authorization: Bearer $CRON_SECRET".
 */
async function handle(request: NextRequest) {
  if (!hasCronSecret(request)) {
    return NextResponse.json({ error: "Niet toegestaan" }, { status: 401 });
  }
  const report = await runTick();
  return NextResponse.json(report);
}

export const GET = handle;
export const POST = handle;
