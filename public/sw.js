/* Takenlijstje service worker
 * - offline: eerder bezochte pagina's en statische bestanden uit de cache
 * - pushmeldingen tonen en bij tikken de juiste pagina openen
 */
const VERSION = "v2";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const PRECACHE = ["/offline", "/icons/icon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Uitloggen: opgeslagen pagina's (met gegevens) van dit apparaat wissen
  if (request.method === "POST" && url.pathname === "/auth/signout") {
    event.waitUntil(caches.delete(PAGE_CACHE));
    return;
  }
  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Statische bestanden: eerst uit de cache
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Pagina's: eerst het netwerk, bij geen verbinding de laatst bekende versie
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic" && !response.redirected) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match("/")) || caches.match("/offline")),
    );
  }
});

// Uitloggen, uitgezet of niet meer lid: opgeslagen pagina's (met gegevens) wissen (BR-43)
self.addEventListener("message", (event) => {
  if (event.origin && event.origin !== self.location.origin) return;
  if (event.data && event.data.type === "CLEAR_PAGES") {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

/** Alleen een pad binnen deze app; anders de startpagina (B-03: geen open redirect) */
function internalUrl(value) {
  try {
    const url = new URL(typeof value === "string" && value ? value : "/", self.location.origin);
    return url.origin === self.location.origin ? url.href : new URL("/", self.location.origin).href;
  } catch {
    return new URL("/", self.location.origin).href;
  }
}

self.addEventListener("push", (event) => {
  let data = { title: "Takenlijstje", body: "", url: "/", tag: undefined };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = internalUrl(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
