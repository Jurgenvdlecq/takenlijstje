"use client";

/**
 * Wist alle gegevens van het huishouden op dit toestel (BR-43,
 * TECHNICAL_DESIGN §4.4): de offline-cache, de wachtrij, de opgeslagen
 * pagina's in de service worker en het eigen pushabonnement.
 * Aanroepen bij uitloggen, bij "geen toegang" (uitgezet) en bij "niet meer lid".
 */
import { deletePushSubscriptionAction } from "@/server/actions/notifications";
import { clearCachedSnapshots } from "./cache";
import { clearOutbox } from "./outbox";

export async function clearLocalData(): Promise<void> {
  await Promise.allSettled([clearCachedSnapshots(), clearOutbox()]);

  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    // Ook als deze pagina (nog) niet door de service worker wordt gecontroleerd
    (registration?.active ?? navigator.serviceWorker.controller)?.postMessage({ type: "CLEAR_PAGES" });
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) {
      await deletePushSubscriptionAction(subscription.endpoint).catch(() => undefined);
      await subscription.unsubscribe();
    }
  } catch {
    // Geen service worker of push: niets te wissen
  }
}
