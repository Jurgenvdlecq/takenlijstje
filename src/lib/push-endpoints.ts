/**
 * Alleen abonnementen bij de bekende pushdiensten van de browsers worden
 * geaccepteerd en aangeschreven. Zo stuurt de server nooit verzoeken naar een
 * willekeurige host die iemand als "endpoint" opgeeft (security-review WP1, schuld WP3).
 *
 * De controle werkt op de ruwe tekst: de host mag alleen letters, cijfers,
 * punten en streepjes bevatten, direct gevolgd door "/" (of ":443/"). Zo kan
 * geen verschil tussen URL-parsers (bijv. `url.parse` in web-push tegenover
 * `new URL`) een andere host opleveren (security-review WP3, punt 1).
 */
const ALLOWED_HOST_SUFFIXES = [
  "fcm.googleapis.com", // Chrome, Edge (Chromium), Android
  "push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari, iOS/iPadOS als geïnstalleerde app
  "notify.windows.com", // oudere Edge/Windows
];

const escaped = ALLOWED_HOST_SUFFIXES.map((s) => s.replace(/\./g, "\\.")).join("|");
/** Gelijk aan de CHECK op push_subscriptions.endpoint (…_310) */
/** Pad: alleen zichtbare ASCII, zonder " ' ; < > \\ ` { } (security-herreview WP3, punt A) */
const PATH_CHARS = "[!#-&(-:=?-\\[\\]-_a-z|~]";
export const PUSH_ENDPOINT_PATTERN = new RegExp(`^https://([a-z0-9-]+\\.)*(${escaped})(:443)?/${PATH_CHARS}*$`);

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== "string" || endpoint.length > 1000 || !PUSH_ENDPOINT_PATTERN.test(endpoint)) return false;
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    return url.protocol === "https:" && !url.username && !url.password &&
      ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}
