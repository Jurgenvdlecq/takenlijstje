/**
 * Offline-wachtrij over deploys heen (TECHNICAL_DESIGN §9.3.1).
 *
 * Iedere entry draagt een versie. Entries zonder versie zijn versie 0 (de app
 * van vóór WP1). De server zet oude vormen om naar de huidige; soorten die niet
 * meer bestaan worden NIET stil weggegooid maar krijgen de uitkomst
 * "obsolete", zodat de gebruiker een melding ziet.
 *
 * Puur: geen I/O, volledig testbaar.
 */

/** Huidige versie van het wachtrijformaat */
export const OUTBOX_VERSION = 1;

/** Soorten die de huidige server kent */
export const OUTBOX_KINDS = [
  "complete",
  "undo",
  "setStatus",
  "move",
  "assign",
  "shoppingAdd",
  "shoppingToggle",
  "shoppingDelete",
  "markRead",
] as const;

export type OutboxKind = (typeof OUTBOX_KINDS)[number];

/** Leesbare naam van een vervallen functie, voor de melding aan de gebruiker */
const OBSOLETE_LABELS: Record<string, string> = {};

export type MigrationResult =
  | { status: "ok"; kind: OutboxKind; payload: Record<string, unknown> }
  | { status: "obsolete"; kind: string; label: string }
  | { status: "invalid"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKnownKind(kind: string): kind is OutboxKind {
  return (OUTBOX_KINDS as readonly string[]).includes(kind);
}

/**
 * Zet een entry van versie `v` om naar de huidige vorm.
 * @param generateId wordt gebruikt als een oude entry nog geen eigen id had
 */
export function migrateOutboxEntry(
  v: number | undefined,
  kind: unknown,
  payload: unknown,
  generateId: () => string,
): MigrationResult {
  const version = v ?? 0;
  if (!Number.isInteger(version) || version < 0 || version > OUTBOX_VERSION) {
    return { status: "invalid", reason: "onbekende versie" };
  }
  if (typeof kind !== "string" || !kind) return { status: "invalid", reason: "geen soort" };
  if (!isRecord(payload)) return { status: "invalid", reason: "geen gegevens" };

  if (!isKnownKind(kind)) {
    return { status: "obsolete", kind, label: OBSOLETE_LABELS[kind] ?? kind };
  }

  const next: Record<string, unknown> = { ...payload };

  // v0: een boodschap zonder eigen id krijgt er alsnog een (idempotent opnieuw versturen)
  if (version === 0 && kind === "shoppingAdd" && typeof next.id !== "string") {
    next.id = generateId();
  }

  return { status: "ok", kind, payload: next };
}
