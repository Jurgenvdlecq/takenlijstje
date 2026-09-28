import "server-only";

/**
 * Planner: vult de planning van reeksen aan (alleen INVOEGEN van geplande
 * uitvoeringen en generated_until bijwerken). Dit is een systeemhandeling met
 * de service role, zodat ook een gezinslid zonder aanmaakrecht na afvinken de
 * volgende uitvoering krijgt. Wordt vanuit een gebruikersactie pas aangeroepen
 * NADAT de rechtenstap (RLS of RPC) geslaagd is (TECHNICAL_DESIGN §5.3).
 *
 * Een mislukte planning laat de gebruikersactie niet falen: de volgende tick
 * vult de planning alsnog aan.
 */
import type { ISODate } from "@/domain/dates";
import type { TaskRow } from "@/types/database";
import { topUpSeries } from "../services/scheduling";
import { createAdminClient, hasAdminClient } from "./admin-client";

export async function topUp(householdId: string, recurrenceIds: string[], from?: ISODate): Promise<TaskRow[]> {
  if (!recurrenceIds.length) return [];
  if (!hasAdminClient()) {
    console.error("[planner] niet uitgevoerd: systeemsleutel ontbreekt");
    return [];
  }
  try {
    return await topUpSeries(createAdminClient(), householdId, { recurrenceIds, from });
  } catch (error) {
    console.error(`[planner] mislukt: ${(error as Error)?.name ?? "fout"} ${(error as { code?: string })?.code ?? ""}`.trim());
    return [];
  }
}
