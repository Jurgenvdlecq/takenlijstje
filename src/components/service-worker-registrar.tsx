"use client";

import * as React from "react";

/** Registreert de service worker (offline + pushmeldingen), alleen in productie. */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Geen service worker: app werkt gewoon, alleen zonder offline/push
    });
  }, []);
  return null;
}
