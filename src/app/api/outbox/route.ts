import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { migrateOutboxEntry, type OutboxKind } from "@/domain/outbox/migrate";
import { publicEnv } from "@/lib/env";
import { markNotificationsReadAction } from "@/server/actions/notifications";
import { addShoppingItemAction, deleteShoppingItemAction, toggleShoppingItemAction } from "@/server/actions/shopping";
import {
  assignTaskAction,
  completeTaskAction,
  moveTaskAction,
  setTaskStatusAction,
  undoCompleteAction,
} from "@/server/actions/tasks";
import type { ActionResult } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * Eén stabiel adres voor snelle acties en de offline-wachtrij
 * (TECHNICAL_DESIGN §9.3.1). Server-action-id's veranderen per build; dit
 * adres niet, zodat wachtende acties een deploy overleven.
 *
 * Autorisatie: precies dezelfde server actions (requireMember uit de cookies,
 * zod, RLS). De proxy stuurt dit pad niet door naar /login, zodat een
 * verlopen sessie een 401 in JSON geeft en de client de actie laat staan.
 */
type Payload = Record<string, unknown>;

const handlers: Record<OutboxKind, (p: Payload) => Promise<ActionResult<unknown>>> = {
  complete: (p) => completeTaskAction(p as Parameters<typeof completeTaskAction>[0]),
  undo: (p) => undoCompleteAction(p.taskId as string),
  setStatus: (p) => setTaskStatusAction(p.taskId as string, p.status as Parameters<typeof setTaskStatusAction>[1]),
  move: (p) => moveTaskAction(p.taskId as string, p.date as string),
  assign: (p) => assignTaskAction(p.taskId as string, (p.memberId ?? null) as string | null),
  shoppingAdd: (p) => addShoppingItemAction(p as Parameters<typeof addShoppingItemAction>[0]),
  shoppingToggle: (p) => toggleShoppingItemAction(p.id as string, p.bought as boolean),
  shoppingDelete: (p) => deleteShoppingItemAction(p.id as string),
  markRead: (p) => markNotificationsReadAction(p.ids as string[] | undefined),
};

/** CSRF: alleen vanaf de eigen site, en alleen als JSON (dwingt een preflight af bij cross-origin) */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set<string>([new URL(request.url).origin]);
  if (publicEnv.siteUrl) {
    try {
      allowed.add(new URL(publicEnv.siteUrl).origin);
    } catch {
      // ongeldige SITE_URL: alleen de eigen origin
    }
  }
  return allowed.has(origin);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json({ ok: false, code: "VALIDATION", error: "Ongeldig verzoek." }, 415);
  }
  if (!sameOrigin(request)) {
    return json({ ok: false, code: "FORBIDDEN", error: "Niet toegestaan." }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "VALIDATION", error: "Ongeldig verzoek." }, 400);
  }
  const entry = (typeof body === "object" && body !== null ? body : {}) as { v?: number; kind?: unknown; payload?: unknown };

  const migrated = migrateOutboxEntry(entry.v, entry.kind, entry.payload, randomUUID);
  if (migrated.status === "invalid") {
    return json({ ok: false, code: "VALIDATION", error: "Deze wijziging kon niet worden gelezen." });
  }
  if (migrated.status === "obsolete") {
    return json({
      ok: false,
      code: "DISCARDED_OBSOLETE",
      error: `Een offline wijziging hoort bij een functie die niet meer bestaat (${migrated.label}) en is niet uitgevoerd.`,
    });
  }

  const result = await handlers[migrated.kind](migrated.payload);
  if (!result.ok && result.code === "UNAUTHENTICATED") return json(result, 401);
  return json(result);
}
