import { afterEach, describe, expect, it, vi } from "vitest";

// "server-only" gooit buiten de React-servercontext; voor deze pure functies niet relevant
vi.mock("server-only", () => ({}));

import { expectRows, runAction, toFailure, UserError } from "../errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("expectRows: stille RLS-weigering telt als weigering (B-01, AC-009)", () => {
  it("0 rijen (lege lijst) → UserError FORBIDDEN", () => {
    expect(() => expectRows({ data: [], error: null })).toThrowError(UserError);
    try {
      expectRows({ data: [], error: null });
    } catch (error) {
      expect((error as UserError).code).toBe("FORBIDDEN");
      expect((error as UserError).message).toBe("Dit mag je niet wijzigen, of het bestaat niet meer.");
    }
  });

  it("data null → ook FORBIDDEN", () => {
    expect(() => expectRows({ data: null, error: null })).toThrowError(/niet wijzigen/);
  });

  it("met eigen tekst en code NOT_FOUND", () => {
    try {
      expectRows({ data: [], error: null }, "Taak niet gevonden.", "NOT_FOUND");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UserError);
      expect((error as UserError).code).toBe("NOT_FOUND");
      expect((error as UserError).message).toBe("Taak niet gevonden.");
    }
  });

  it("1 of meer rijen → geeft de data terug", () => {
    expect(expectRows({ data: [{ id: "a" }], error: null })).toEqual([{ id: "a" }]);
    expect(expectRows({ data: { id: "a" }, error: null })).toEqual({ id: "a" });
  });

  it("een databasefout gaat voor en wordt doorgegooid", () => {
    const pgError = { code: "42501", message: "new row violates row-level security policy" };
    expect(() => expectRows({ data: null, error: pgError })).toThrow(expect.objectContaining({ code: "42501" }));
  });
});

describe("toFailure: nette Nederlandse melding + code (§6, AC-033)", () => {
  it("UserError behoudt tekst en code", () => {
    expect(toFailure(new UserError("Taak niet gevonden.", "NOT_FOUND"))).toEqual({ error: "Taak niet gevonden.", code: "NOT_FOUND" });
  });

  it("42501 met een policytekst → FORBIDDEN zonder policynaam", () => {
    const result = toFailure({ code: "42501", message: 'new row violates row-level security policy for table "tasks"' });
    expect(result).toEqual({ error: "Je hebt geen rechten voor deze actie.", code: "FORBIDDEN" });
  });

  it("42501 'permission denied for function' → FORBIDDEN zonder functienaam", () => {
    const result = toFailure({ code: "42501", message: "permission denied for function guard_task_changes" });
    expect(result.code).toBe("FORBIDDEN");
    expect(result.error).not.toMatch(/guard|function|permission/);
  });

  it("42501 met een eigen RPC-melding → die melding, FORBIDDEN", () => {
    expect(toFailure({ code: "42501", message: "Alleen een beheerder of wie de reeks maakte mag dit" })).toEqual({
      error: "Alleen een beheerder of wie de reeks maakte mag dit",
      code: "FORBIDDEN",
    });
  });

  it.each([
    ["23505", "CONFLICT"],
    ["23503", "NOT_FOUND"],
    ["23514", "VALIDATION"],
    ["22023", "VALIDATION"],
    ["P0001", "VALIDATION"],
    ["P0002", "NOT_FOUND"],
    ["PGRST116", "NOT_FOUND"],
  ])("databasecode %s → %s", (pgCode, code) => {
    expect(toFailure({ code: pgCode, message: 'violates check constraint "notifications_url_intern"' }).code).toBe(code);
  });

  it("constraintnaam lekt niet naar de gebruiker (23514)", () => {
    const result = toFailure({ code: "23514", message: 'new row for relation "notifications" violates check constraint "notifications_url_intern"' });
    expect(result.error).toBe("Ongeldige invoer.");
  });

  it("onbekende fout → UNKNOWN met een algemene tekst", () => {
    expect(toFailure(new Error("socket hang up at 10.0.0.1"))).toEqual({ error: "Er ging iets mis. Probeer het opnieuw.", code: "UNKNOWN" });
    expect(toFailure(undefined).code).toBe("UNKNOWN");
  });
});

describe("runAction: schone logs (AC-033, TECHNICAL_DESIGN §9.4)", () => {
  it("logt alleen actienaam, fouttype en code; geen invoer, namen, e-mail of ids", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const geheim = {
      code: "42501",
      name: "PostgrestError",
      message: 'new row violates row-level security policy for table "tasks"',
      details: "Failing row contains (Badkamer, jurgen@example.com, 00000000-0000-0000-0000-00000000000a)",
    };
    const result = await runAction("updateTask", async () => {
      throw geheim;
    });
    expect(result).toEqual({ ok: false, error: "Je hebt geen rechten voor deze actie.", code: "FORBIDDEN" });
    expect(log).toHaveBeenCalledTimes(1);
    const regel = log.mock.calls[0].map(String).join(" ");
    expect(regel).toBe("[action:updateTask] PostgrestError 42501");
    expect(regel).not.toMatch(/example\.com|Badkamer|0000000a/);
  });

  it("een UserError wordt niet gelogd (verwachte weigering)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await runAction("deleteTask", async () => {
      throw new UserError("Taak niet gevonden.", "NOT_FOUND");
    });
    expect(result).toEqual({ ok: false, error: "Taak niet gevonden.", code: "NOT_FOUND" });
    expect(log).not.toHaveBeenCalled();
  });

  it("gelukt → ok met data", async () => {
    expect(await runAction("x", async () => 42)).toEqual({ ok: true, data: 42 });
  });

  it("Next.js redirect/notFound wordt doorgegooid, niet vertaald", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    await expect(runAction("x", async () => { throw redirect; })).rejects.toBe(redirect);
  });
});
