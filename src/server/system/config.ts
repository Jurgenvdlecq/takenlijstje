import "server-only";

import { hasAdminClient } from "./admin-client";

/** Is de systeemsleutel ingesteld? (zonder de sleutel zelf buiten src/server/system te brengen) */
export function hasSystemKey(): boolean {
  return hasAdminClient();
}
