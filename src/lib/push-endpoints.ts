/**
 * Alleen abonnementen bij de bekende pushdiensten van de browsers worden
 * geaccepteerd en aangeschreven. Zo stuurt de server nooit verzoeken naar een
 * willekeurige host die iemand als "endpoint" opgeeft (security-review WP1, schuld WP3).
 */
const ALLOWED_HOST_SUFFIXES = [
  "fcm.googleapis.com", // Chrome, Edge (Chromium), Android
  "push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari, iOS/iPadOS als geïnstalleerde app
  "notify.windows.com", // oudere Edge/Windows
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}
