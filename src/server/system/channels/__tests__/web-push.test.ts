import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WP3 — pushkanaal (TECHNICAL_DESIGN §10, §11.3; ACCEPTANCE_CRITERIA AC-075, AC-076):
 * time-out en TTL per verzoek, hooguit 5 tegelijk, stoppen na het tijdsbudget,
 * dode abonnementen (404/410) weg, overige fouten alleen met statuscode gelogd.
 * web-push is gemockt: er gaat niets naar een echte pushdienst.
 */
vi.mock("server-only", () => ({}));

const webpush = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));
vi.mock("web-push", () => ({ default: webpush, ...webpush }));

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-vapid-publiek";
  process.env.VAPID_PRIVATE_KEY = "test-vapid-prive";
});

import { PUSH_CONCURRENCY, runLimited, sendPush, type PushSubscriptionRow } from "../web-push";
import type { DbClient } from "@/lib/supabase/server";

/** Minimale nep-database die bijhoudt welke schrijfacties op push_subscriptions gebeuren */
function nepDb() {
  const acties: { actie: "update" | "delete"; id: unknown; waarden?: unknown }[] = [];
  const db = {
    from: (table: string) => {
      expect(table).toBe("push_subscriptions");
      return {
        update: (waarden: unknown) => ({ eq: async (_k: string, id: unknown) => (acties.push({ actie: "update", id, waarden }), { error: null }) }),
        delete: () => ({ eq: async (_k: string, id: unknown) => (acties.push({ actie: "delete", id }), { error: null }) }),
      };
    },
  };
  return { db: db as unknown as DbClient, acties };
}

const sub: PushSubscriptionRow = {
  id: "sub-1",
  user_id: "u-1",
  endpoint: "https://fcm.googleapis.com/fcm/send/geheim-endpoint",
  p256dh: "p",
  auth: "a",
};
const message = { type: "reminder" as const, title: "Herinnering: Afwas", dedupeKey: "reminder:t:60:x" };

beforeEach(() => {
  webpush.sendNotification.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendPush", () => {
  it("stuurt met time-out 10 s en TTL 6 uur, en werkt last_used_at bij", async () => {
    webpush.sendNotification.mockResolvedValue({ statusCode: 201 });
    const { db, acties } = nepDb();
    expect(await sendPush(db, sub, message)).toBe(true);
    const [target, payload, options] = webpush.sendNotification.mock.calls[0];
    // web-push krijgt de genormaliseerde URL (new URL(...).href), zelfde host
    expect(target.endpoint).toBe(new URL(sub.endpoint).href);
    expect(options).toMatchObject({ timeout: 10_000, TTL: 6 * 60 * 60 });
    expect(JSON.parse(payload)).toMatchObject({ title: "Herinnering: Afwas", tag: "reminder:t:60:x" });
    expect(acties).toEqual([{ actie: "update", id: "sub-1", waarden: { last_used_at: expect.any(String) } }]);
  });

  it.each([404, 410])("verwijdert het abonnement bij %i (AC-075)", async (statusCode) => {
    webpush.sendNotification.mockRejectedValue(Object.assign(new Error("weg"), { statusCode }));
    const { db, acties } = nepDb();
    expect(await sendPush(db, sub, message)).toBe(false);
    expect(acties).toEqual([{ actie: "delete", id: "sub-1" }]);
  });

  it("laat het abonnement staan bij een andere fout en logt alleen de statuscode, niet het endpoint", async () => {
    webpush.sendNotification.mockRejectedValue(Object.assign(new Error("server kapot https://fcm.googleapis.com/fcm/send/geheim-endpoint"), { statusCode: 500 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, acties } = nepDb();
    expect(await sendPush(db, sub, message)).toBe(false);
    expect(acties).toEqual([]);
    const regels = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(regels).toContain("500");
    expect(regels).not.toContain("geheim-endpoint");
    expect(regels).not.toContain("Afwas");
  });

  it.each([
    "https://evil.com/fcm/send/abc",
    "https://fcm.googleapis.com.evil.com/x",
    "https://user:pass@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://evil.com;.fcm.googleapis.com/x",
    "https://169.254.169.254;.fcm.googleapis.com/x",
    "https://localhost;.push.apple.com/x",
    "https://evil.com{.fcm.googleapis.com/x",
    "https://evil.com`.fcm.googleapis.com/x",
    "https://evil.com'.fcm.googleapis.com/x",
    'https://evil.com".fcm.googleapis.com/x',
    "https://evil.com\\.fcm.googleapis.com/x",
    "https://FCM.GoogleAPIs.com/x",
  ])("niet-toegestaan endpoint %s: niet aangeschreven, abonnement verwijderd", async (endpoint) => {
    const { db, acties } = nepDb();
    expect(await sendPush(db, { ...sub, endpoint }, message)).toBe(false);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(acties).toEqual([{ actie: "delete", id: "sub-1" }]);
  });

  it("een time-out (geen statuscode) verwijdert niets en gooit niet", async () => {
    webpush.sendNotification.mockRejectedValue(new Error("ETIMEDOUT"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, acties } = nepDb();
    await expect(sendPush(db, sub, message)).resolves.toBe(false);
    expect(acties).toEqual([]);
  });
});

describe("sendPush met een ongeldige VAPID-configuratie (code-review WP3, punt 9)", () => {
  it("gooit niet: geeft false, verwijdert niets en logt zonder sleutel", async () => {
    vi.resetModules();
    webpush.setVapidDetails.mockImplementationOnce(() => {
      throw new Error("Vapid private key should be 32 bytes long test-vapid-prive");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const vers = await import("../web-push");
    const { db, acties } = nepDb();
    await expect(vers.sendPush(db, sub, message)).resolves.toBe(false);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(acties).toEqual([]);
    expect(log.mock.calls.map((c) => c.join(" ")).join("\n")).not.toContain("test-vapid-prive");
  });
});

describe("runLimited", () => {
  it("draait hooguit 5 tegelijk (§10) en alles komt aan de beurt", async () => {
    expect(PUSH_CONCURRENCY).toBe(5);
    let bezig = 0;
    let piek = 0;
    const gedaan: number[] = [];
    const started = await runLimited(
      Array.from({ length: 12 }, (_, i) => i),
      PUSH_CONCURRENCY,
      async (i) => {
        bezig++;
        piek = Math.max(piek, bezig);
        await new Promise((r) => setTimeout(r, 5));
        bezig--;
        gedaan.push(i);
      },
    );
    expect(piek).toBe(5);
    expect(started).toBe(12);
    expect(gedaan.sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });

  it("start na de deadline niets nieuws meer; lopend werk mag afmaken (AC-076)", async () => {
    let klok = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => klok);
    const gestart: number[] = [];
    const started = await runLimited(
      [1, 2, 3, 4, 5, 6, 7],
      2,
      async (i) => {
        gestart.push(i);
        klok += 30_000; // elke push "duurt" 30 s
      },
      1_000 + 45_000,
    );
    // Twee werkers starten op t=1 s; na hun push is de klok 61 s > 46 s: niets meer
    expect(started).toBe(2);
    expect(gestart).toEqual([1, 2]);
  });

  it("lege lijst: niets te doen", async () => {
    const work = vi.fn();
    expect(await runLimited([], 5, work)).toBe(0);
    expect(work).not.toHaveBeenCalled();
  });
});
