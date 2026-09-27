import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/server-env";
import { runTick } from "@/server/services/tick";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = serverEnv.cronSecret;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Aanroepen iedere 15 minuten, bijv. via Supabase pg_cron + pg_net,
 * Vercel Cron of cron-job.org, met header "Authorization: Bearer $CRON_SECRET".
 */
async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Niet toegestaan" }, { status: 401 });
  }
  const report = await runTick();
  return NextResponse.json(report);
}

export const GET = handle;
export const POST = handle;
