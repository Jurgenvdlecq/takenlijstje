import "server-only";

import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/server-env";

/** Controleert de header "Authorization: Bearer $CRON_SECRET" in constante tijd. */
export function hasCronSecret(request: Request): boolean {
  const secret = serverEnv.cronSecret;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
