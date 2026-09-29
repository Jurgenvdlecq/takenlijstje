import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/server-env";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Controleert de header "Authorization: Bearer $CRON_SECRET" in constante tijd.
 * Beide kanten worden eerst gehasht, zodat ook de lengte van het geheim niet
 * uit de responstijd valt af te leiden (security-review WP3, punt 4).
 */
export function hasCronSecret(request: Request): boolean {
  const secret = serverEnv.cronSecret;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
