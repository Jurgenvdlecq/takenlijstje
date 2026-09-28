/**
 * AC-018 / B-03: een tik op een pushmelding blijft binnen de app.
 * public/sw.js is een los script (geen module). We laden het ongewijzigd in een
 * eigen vm-context met een nagebootste service-worker-omgeving en halen de
 * notificationclick-handler en internalUrl() eruit.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const ORIGIN = "https://takenlijstje.example";
const bron = readFileSync(fileURLToPath(new URL("../../../public/sw.js", import.meta.url)), "utf8");

type Handler = (event: unknown) => void;

function laadServiceWorker(openClients: Array<{ navigate: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn> }> = []) {
  const handlers: Record<string, Handler> = {};
  const openWindow = vi.fn(async () => undefined);
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    clients: { matchAll: async () => openClients, openWindow, claim: async () => undefined },
    registration: { showNotification: vi.fn() },
    skipWaiting: () => undefined,
  };
  const context = vm.createContext({ self, URL, caches: {}, fetch: () => Promise.reject(new Error("geen netwerk")) });
  vm.runInContext(bron, context);
  const internalUrl = context.internalUrl as (value: unknown) => string;
  return { handlers, internalUrl, openWindow };
}

async function tikOpMelding(url: unknown) {
  const sw = laadServiceWorker();
  let wacht: Promise<unknown> = Promise.resolve();
  sw.handlers.notificationclick({
    notification: { close: () => undefined, data: { url } },
    waitUntil: (p: Promise<unknown>) => {
      wacht = p;
    },
  });
  await wacht;
  return sw.openWindow.mock.calls[0]?.[0 as never] as string | undefined;
}

describe("service worker: internalUrl (B-03, AC-018)", () => {
  const { internalUrl } = laadServiceWorker();

  it.each([
    ["/?taak=123", `${ORIGIN}/?taak=123`],
    ["/", `${ORIGIN}/`],
    ["/meldingen", `${ORIGIN}/meldingen`],
  ])("intern pad %s blijft binnen de app", (input, verwacht) => {
    expect(internalUrl(input)).toBe(verwacht);
  });

  it.each([
    "//andere-site.nl",
    "/\\andere-site.nl",
    "https://andere-site.nl",
    "https://andere-site.nl/?taak=1",
    "http://takenlijstje.example.evil.nl/",
    "javascript:alert(1)",
    "\\\\andere-site.nl",
  ])("extern adres %s → startpagina van de app", (input) => {
    expect(internalUrl(input)).toBe(`${ORIGIN}/`);
  });

  it.each([undefined, null, "", 42, {}])("geen bruikbare url (%s) → startpagina", (input) => {
    expect(internalUrl(input)).toBe(`${ORIGIN}/`);
  });
});

describe("service worker: tik op een pushmelding opent alleen de eigen app (AC-018)", () => {
  it("url //andere-site.nl opent de startpagina, niet het externe adres", async () => {
    expect(await tikOpMelding("//andere-site.nl")).toBe(`${ORIGIN}/`);
  });

  it("url /?taak=abc opent die taak", async () => {
    expect(await tikOpMelding("/?taak=abc")).toBe(`${ORIGIN}/?taak=abc`);
  });

  it("een open venster navigeert ook alleen naar een intern adres", async () => {
    const client = { navigate: vi.fn(), focus: vi.fn(async () => undefined) };
    const sw = laadServiceWorker([client]);
    let wacht: Promise<unknown> = Promise.resolve();
    sw.handlers.notificationclick({
      notification: { close: () => undefined, data: { url: "https://andere-site.nl" } },
      waitUntil: (p: Promise<unknown>) => {
        wacht = p;
      },
    });
    await wacht;
    expect(client.navigate).toHaveBeenCalledWith(`${ORIGIN}/`);
    expect(sw.openWindow).not.toHaveBeenCalled();
  });
});
