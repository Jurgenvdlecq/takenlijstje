import "server-only";

export type ErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "UNKNOWN";

/** Fout met een boodschap die veilig aan de gebruiker getoond kan worden. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode = "VALIDATION",
  ) {
    super(message);
    this.name = "UserError";
  }
}

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string; code: ErrorCode };

interface PgLikeError {
  code?: string;
  message?: string;
}

/** Eigen Nederlandse RPC-melding (niet een technische policytekst) */
function isOwnMessage(message: string | undefined): message is string {
  return !!message && /[a-z]/.test(message) && !/policy|violates|permission denied|relation|column|function/i.test(message);
}

/** Vertaal fouten naar een begrijpelijke Nederlandse melding plus een code voor de UI. */
export function toFailure(error: unknown): { error: string; code: ErrorCode } {
  if (error instanceof UserError) return { error: error.message, code: error.code };
  const pg = error as PgLikeError;
  switch (pg?.code) {
    case "42501":
      return { error: isOwnMessage(pg.message) ? pg.message : "Je hebt geen rechten voor deze actie.", code: "FORBIDDEN" };
    case "23505":
      return { error: "Dit bestaat al.", code: "CONFLICT" };
    case "23503":
      return { error: "Een gekoppeld item bestaat niet (meer).", code: "NOT_FOUND" };
    case "23514":
    case "22023":
      return { error: isOwnMessage(pg.message) ? pg.message : "Ongeldige invoer.", code: "VALIDATION" };
    case "P0001":
      return { error: isOwnMessage(pg.message) ? pg.message : "Dit kan niet.", code: "VALIDATION" };
    case "P0002":
      return { error: isOwnMessage(pg.message) ? pg.message : "Niet gevonden.", code: "NOT_FOUND" };
    case "PGRST116":
      return { error: "Niet gevonden, of je hebt geen rechten voor deze actie.", code: "NOT_FOUND" };
    default:
      return { error: "Er ging iets mis. Probeer het opnieuw.", code: "UNKNOWN" };
  }
}

/**
 * Voert een server action uit en vangt fouten af.
 * Logt alleen actienaam, fouttype en foutcode – nooit invoer of persoonsgegevens.
 */
export async function runAction<T>(name: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    // redirect()/notFound() van Next.js moeten doorgegooid worden
    if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_")) {
      throw error;
    }
    if (!(error instanceof UserError)) {
      const pg = error as PgLikeError & { name?: string };
      console.error(`[action:${name}] ${pg?.name ?? "Error"} ${pg?.code ?? ""}`.trim());
    }
    return { ok: false, ...toFailure(error) };
  }
}

/** Gooi een Supabase-fout door als die er is. */
export function check<R extends { data: unknown; error: unknown }>(result: R): NonNullable<R["data"]> {
  if (result.error) throw result.error;
  return result.data as NonNullable<R["data"]>;
}

/**
 * Zoals check(), maar voor een update of delete met de gebruikersclient (met
 * `.select(...)`): raakte die 0 rijen, dan heeft RLS geweigerd of bestaat de rij
 * niet (meer). Dat wordt een nette FORBIDDEN-fout in plaats van een stil
 * "gelukt" (dit veroorzaakte B-01). Verplicht bij elke update/delete door een gebruiker.
 */
export function expectRows<R extends { data: unknown; error: unknown }>(
  result: R,
  message = "Dit mag je niet wijzigen, of het bestaat niet meer.",
  code: "FORBIDDEN" | "NOT_FOUND" = "FORBIDDEN",
): NonNullable<R["data"]> {
  const data = check(result);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) throw new UserError(message, code);
  return data;
}
