import { afterEach, describe, expect, it, vi } from "vitest";
import { postOutbox } from "../send";

/** Antwoord van de (nagebootste) server */
function antwoord(status: number, body: unknown, contentType = "application/json") {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
}

function serverGeeft(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postOutbox: wat de wachtrij met een antwoord doet (TECHNICAL_DESIGN §9.3.1, AC-172)", () => {
  it("stuurt v, kind en payload als JSON naar het vaste adres /api/outbox", async () => {
    const fetchMock = serverGeeft(antwoord(200, { ok: true, data: { id: "c1" } }));
    await postOutbox("complete", { taskId: "t1" }, 0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/outbox");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ v: 0, kind: "complete", payload: { taskId: "t1" } });
  });

  it("verwerkt → ok met de data", async () => {
    serverGeeft(antwoord(200, { ok: true, data: { id: "c1" } }));
    expect(await postOutbox("complete", {})).toEqual({ type: "ok", data: { id: "c1" } });
  });

  it("401 → auth (laten staan tot opnieuw inloggen)", async () => {
    serverGeeft(antwoord(401, { ok: false, code: "UNAUTHENTICATED", error: "Log in" }));
    expect(await postOutbox("complete", {})).toEqual({ type: "auth" });
  });

  it("code UNAUTHENTICATED in een 200-antwoord → ook auth", async () => {
    serverGeeft(antwoord(200, { ok: false, code: "UNAUTHENTICATED", error: "Log in" }));
    expect(await postOutbox("complete", {})).toEqual({ type: "auth" });
  });

  it.each([500, 502, 503, 504, 408, 425, 429])("status %i → retry (tijdelijk)", async (status) => {
    serverGeeft(antwoord(status, { ok: false, code: "UNKNOWN" }));
    expect(await postOutbox("complete", {})).toEqual({ type: "retry", reason: "server" });
  });

  it("503 UNSUPPORTED_VERSION (nieuwer formaat na een rollback) → retry, niet weggooien", async () => {
    serverGeeft(antwoord(503, { ok: false, code: "UNSUPPORTED_VERSION", error: "Later" }));
    expect((await postOutbox("complete", {}, 2)).type).toBe("retry");
  });

  it("HTML-foutpagina tijdens een deploy → retry (onbekend antwoord)", async () => {
    serverGeeft(antwoord(200, "<!doctype html><title>Deploying</title>", "text/html"));
    expect(await postOutbox("complete", {})).toEqual({ type: "retry", reason: "unknown" });
  });

  it("kapotte JSON → retry (onbekend antwoord)", async () => {
    serverGeeft(antwoord(200, "{kapot", "application/json"));
    expect(await postOutbox("complete", {})).toEqual({ type: "retry", reason: "unknown" });
  });

  it("netwerkfout → retry met reden network", async () => {
    serverGeeft(new TypeError("Failed to fetch"));
    expect(await postOutbox("complete", {})).toEqual({ type: "retry", reason: "network" });
  });

  it.each(["FORBIDDEN", "NOT_FOUND", "VALIDATION", "CONFLICT", "DISCARDED_OBSOLETE"])(
    "code %s → rejected met de tekst van de server (niet opnieuw proberen)",
    async (code) => {
      serverGeeft(antwoord(200, { ok: false, code, error: "Taak niet gevonden." }));
      expect(await postOutbox("complete", {})).toEqual({ type: "rejected", error: "Taak niet gevonden.", code });
    },
  );

  it("rejected zonder tekst krijgt een nette standaardtekst", async () => {
    serverGeeft(antwoord(200, { ok: false, code: "FORBIDDEN" }));
    expect(await postOutbox("complete", {})).toEqual({ type: "rejected", error: "Deze wijziging is niet uitgevoerd.", code: "FORBIDDEN" });
  });

  it("code UNKNOWN of een onbekende code → retry", async () => {
    serverGeeft(antwoord(200, { ok: false, code: "UNKNOWN", error: "Er ging iets mis." }));
    expect(await postOutbox("complete", {})).toEqual({ type: "retry", reason: "server" });
    serverGeeft(antwoord(200, { ok: false, code: "IETS_NIEUWS" }));
    expect(await postOutbox("complete", {})).toEqual({ type: "retry", reason: "server" });
  });
});
