"use client";

/**
 * Snelle acties en de offline-wachtrij gaan via één stabiel adres,
 * POST /api/outbox (TECHNICAL_DESIGN §9.3.1). De uitkomst bepaalt wat de
 * wachtrij doet; er wordt nooit iets weggegooid zonder dat de gebruiker het ziet.
 */
import { OUTBOX_VERSION } from "@/domain/outbox/migrate";

export type SendOutcome =
  /** Verwerkt */
  | { type: "ok"; data: unknown }
  /** Door de server geweigerd (geen rechten, niet gevonden, ongeldig, vervallen functie): niet opnieuw proberen */
  | { type: "rejected"; error: string; code: string }
  /** Niet (meer) ingelogd: laten staan tot de gebruiker opnieuw inlogt */
  | { type: "auth" }
  /** Tijdelijk probleem (geen netwerk, serverfout, onbekend antwoord): later opnieuw */
  | { type: "retry"; reason: "network" | "server" | "unknown" };

const RETRY_STATUS = new Set([408, 425, 429]);
const REJECT_CODES = new Set(["FORBIDDEN", "NOT_FOUND", "VALIDATION", "CONFLICT", "DISCARDED_OBSOLETE"]);

/** @param v versie van de entry; oude wachtrij-items (zonder versie) zijn versie 0 */
export async function postOutbox(kind: string, payload: unknown, v: number = OUTBOX_VERSION): Promise<SendOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/outbox", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ v, kind, payload }),
    });
  } catch {
    return { type: "retry", reason: "network" };
  }

  if (response.status === 401) return { type: "auth" };
  if (response.status >= 500 || RETRY_STATUS.has(response.status)) return { type: "retry", reason: "server" };
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
    // Bijvoorbeeld een HTML-foutpagina tijdens een deploy
    return { type: "retry", reason: "unknown" };
  }

  let body: { ok?: boolean; data?: unknown; error?: string; code?: string };
  try {
    body = await response.json();
  } catch {
    return { type: "retry", reason: "unknown" };
  }
  if (body.ok === true) return { type: "ok", data: body.data };
  if (body.code === "UNAUTHENTICATED") return { type: "auth" };
  if (body.code && REJECT_CODES.has(body.code)) {
    return { type: "rejected", error: body.error ?? "Deze wijziging is niet uitgevoerd.", code: body.code };
  }
  // UNKNOWN of iets onverwachts: tijdelijk probleem aan de serverkant
  return { type: "retry", reason: "server" };
}
