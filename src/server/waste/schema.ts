/**
 * Parsers voor de antwoorden van de huisvuilkalender (TECHNICAL_DESIGN §18.1.4).
 * Alleen verplicht wat we gebruiken; onbekende velden vallen weg. Straat en
 * plaats dienen alleen voor "Klopt dit?" en worden nooit bewaard of gelogd.
 */
import { z } from "zod";
import type { AddressCandidate } from "@/domain/waste/address";
import type { StreamDef } from "@/domain/waste/streams";

const BAG_ID_RE = /^[0-9]{16}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const idLike = z.union([z.string(), z.number()]).transform((v) => String(v).trim());
const optionalText = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined ? null : String(v).trim() || null));

const candidate = z
  .object({
    bagId: idLike.optional(),
    bagid: idLike.optional(),
    huisletter: optionalText,
    huisnummerToevoeging: optionalText,
    huisnummer: z.union([z.number(), z.string()]).optional(),
    straatnaam: optionalText,
    straat: optionalText,
    woonplaats: optionalText,
    plaats: optionalText,
  })
  .transform((c, ctx): AddressCandidate => {
    const bagId = c.bagId ?? c.bagid ?? "";
    if (!BAG_ID_RE.test(bagId)) {
      ctx.addIssue({ code: "custom", message: "bagId" });
      return z.NEVER;
    }
    const houseNumber = c.huisnummer === undefined ? null : Number(c.huisnummer);
    return {
      bagId,
      huisletter: c.huisletter,
      huisnummerToevoeging: c.huisnummerToevoeging,
      street: c.straatnaam ?? c.straat,
      houseNumber: Number.isInteger(houseNumber) ? houseNumber : null,
      city: c.woonplaats ?? c.plaats,
    };
  });

export const addressesSchema = z.array(candidate).max(500);

export const streamsSchema = z
  .array(
    z.object({
      id: idLike,
      title: z.string().max(200),
      menu_title: optionalText,
      icon: optionalText,
    }),
  )
  .max(100)
  .transform((rows): StreamDef[] => rows.map((r) => ({ id: r.id, title: r.title, menuTitle: r.menu_title, icon: r.icon })));

export interface RawPickup {
  streamId: string;
  date: string;
}

export const calendarSchema = z
  .array(
    z.object({
      afvalstroom_id: idLike,
      ophaaldatum: z.union([z.string(), z.null()]).optional(),
    }),
  )
  .max(5000)
  .transform((rows): RawPickup[] =>
    rows
      .filter((r) => typeof r.ophaaldatum === "string" && ISO_DATE_RE.test(r.ophaaldatum.slice(0, 10)))
      .map((r) => ({ streamId: r.afvalstroom_id, date: (r.ophaaldatum as string).slice(0, 10) })),
  );
