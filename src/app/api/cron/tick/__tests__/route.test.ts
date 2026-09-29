import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WP3 — de tick-route (TECHNICAL_DESIGN §6.5, §12.2): alleen met
 * "Authorization: Bearer $CRON_SECRET", anders 401 en geen tick.
 * De tick zelf is gemockt; die wordt apart getest (tests/integration/tick.test.ts).
 */
vi.mock("server-only", () => ({}));

import type { TickReport } from "@/server/system/tick";

const tick = vi.hoisted(() => ({
  runTick: vi.fn(
    async (): Promise<TickReport> => ({ households: 1, planned: 2, skipped: 0, notified: 3, pushed: 1, purged: { tasks: 0 }, failed: [] }),
  ),
}));
vi.mock("@/server/system/tick", () => tick);

vi.hoisted(() => {
  process.env.CRON_SECRET = "test-cron-geheim-0123456789";
});

import { NextRequest } from "next/server";
import { GET, POST, maxDuration } from "../route";

const URL_TICK = "http://localhost/api/cron/tick";
const verzoek = (headers: Record<string, string> = {}) => new NextRequest(URL_TICK, { headers });

beforeEach(() => {
  tick.runTick.mockClear();
});

describe("cron-tick: authenticatie", () => {
  it("zonder Authorization-header: 401 en geen tick", async () => {
    const res = await GET(verzoek());
    expect(res.status).toBe(401);
    expect(tick.runTick).not.toHaveBeenCalled();
  });

  it("met een fout geheim: 401 en geen tick", async () => {
    const res = await GET(verzoek({ authorization: "Bearer iets-anders" }));
    expect(res.status).toBe(401);
    expect(tick.runTick).not.toHaveBeenCalled();
  });

  it.each([
    ["het juiste geheim met iets erachter", "Bearer test-cron-geheim-0123456789x"],
    ["alleen een voorvoegsel van het geheim", "Bearer test-cron-geheim-012345678"],
    ["andere hoofdletters", "bearer test-cron-geheim-0123456789"],
  ])("gehashte vergelijking (security-review WP3, punt 4): %s → 401", async (_naam, authorization) => {
    const res = await GET(verzoek({ authorization }));
    expect(res.status).toBe(401);
    expect(tick.runTick).not.toHaveBeenCalled();
  });

  it("met een fout geheim van dezelfde lengte: 401", async () => {
    const res = await POST(verzoek({ authorization: "Bearer test-cron-geheim-0123456780" }));
    expect(res.status).toBe(401);
    expect(tick.runTick).not.toHaveBeenCalled();
  });

  it("het geheim zonder 'Bearer ': 401", async () => {
    const res = await GET(verzoek({ authorization: "test-cron-geheim-0123456789" }));
    expect(res.status).toBe(401);
    expect(tick.runTick).not.toHaveBeenCalled();
  });

  it("de 401 verklapt niets over het geheim", async () => {
    const res = await GET(verzoek({ authorization: "Bearer x" }));
    const body = await res.text();
    expect(body).not.toContain("test-cron-geheim");
  });

  it.each([
    ["GET", GET],
    ["POST", POST],
  ] as const)("%s met het juiste geheim: 200 en precies één tick, antwoord alleen tellingen", async (_naam, handler) => {
    const res = await handler(verzoek({ authorization: "Bearer test-cron-geheim-0123456789" }));
    expect(res.status).toBe(200);
    expect(tick.runTick).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ households: 1, planned: 2, skipped: 0, notified: 3, pushed: 1, purged: { tasks: 0 }, failed: [] });
  });

  it("faalde een stap: status 500, body blijft alleen tellingen en codes (code-review WP3, punt 2)", async () => {
    const report = { households: 1, planned: 0, skipped: 0, notified: 0, pushed: 0, purged: { tasks: 0 }, failed: ["meldingen"] };
    tick.runTick.mockResolvedValueOnce(report);
    const res = await GET(verzoek({ authorization: "Bearer test-cron-geheim-0123456789" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(report);
  });

  it("faalden alle stappen: ook 500", async () => {
    tick.runTick.mockResolvedValueOnce({ households: 0, planned: 0, skipped: 0, notified: 0, pushed: 0, purged: null, failed: ["plannen", "overslaan", "meldingen", "opruimen"] });
    const res = await POST(verzoek({ authorization: "Bearer test-cron-geheim-0123456789" }));
    expect(res.status).toBe(500);
  });

  it("de functie krijgt 60 s (§6.5), ruim boven het pushbudget van 45 s", () => {
    expect(maxDuration).toBe(60);
  });
});

describe("cron-tick: zonder ingesteld CRON_SECRET", () => {
  it("weigert alles, ook 'Bearer ' met een leeg geheim", async () => {
    const vorige = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "";
    vi.resetModules();
    try {
      const route = await import("../route");
      for (const authorization of ["Bearer ", "Bearer", ""]) {
        const res = await route.GET(verzoek(authorization ? { authorization } : {}));
        expect(res.status).toBe(401);
      }
      expect(tick.runTick).not.toHaveBeenCalled();
    } finally {
      process.env.CRON_SECRET = vorige;
      vi.resetModules();
    }
  });
});
