import "server-only";

/** Fout met een boodschap die veilig aan de gebruiker getoond kan worden. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

interface PgLikeError {
  code?: string;
  message?: string;
}

/** Vertaal databasefouten naar begrijpelijke Nederlandse meldingen. */
function friendlyMessage(error: unknown): string {
  if (error instanceof UserError) return error.message;
  const pg = error as PgLikeError;
  switch (pg?.code) {
    case "42501":
      return pg.message && /[a-z]/.test(pg.message) && !pg.message.includes("policy")
        ? pg.message
        : "Je hebt geen rechten voor deze actie.";
    case "23505":
      return "Dit bestaat al.";
    case "23503":
      return "Een gekoppeld item bestaat niet (meer).";
    case "23514":
      return pg.message ?? "Ongeldige invoer.";
    case "P0002":
      return pg.message ?? "Niet gevonden.";
    case "PGRST116":
      return "Niet gevonden.";
    default:
      return "Er ging iets mis. Probeer het opnieuw.";
  }
}

/**
 * Voert een server action uit en vangt fouten af.
 * Logt alleen foutcode en type – nooit invoer of persoonsgegevens.
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
    return { ok: false, error: friendlyMessage(error) };
  }
}

/** Gooi een Supabase-fout door als die er is. */
export function check<R extends { data: unknown; error: unknown }>(result: R): NonNullable<R["data"]> {
  if (result.error) throw result.error;
  return result.data as NonNullable<R["data"]>;
}
