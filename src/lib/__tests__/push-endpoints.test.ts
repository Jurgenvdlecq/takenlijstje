import { parse } from "node:url";
import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint, PUSH_ENDPOINT_PATTERN } from "../push-endpoints";
import { pushSubscriptionInput } from "../validation";

/**
 * Push-endpoint-allowlist (security-review WP1, technische schuld WP3; security-review
 * WP3 punt 1): alleen de pushdiensten van de browsers, via https op poort 443, zonder
 * inloggegevens, en gecontroleerd op de ruwe tekst (geen parserverschillen).
 */
const TOEGESTAAN = [
  "https://fcm.googleapis.com/fcm/send/abc:def",
  "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
  "https://web.push.apple.com/QGx1c3Q",
  "https://wns2-db5p.notify.windows.com/w/?token=abc",
  "https://fcm.googleapis.com:443/fcm/send/abc",
];

const GEWEIGERD: [string, string][] = [
  ["andere host", "https://evil.com/fcm/send/abc"],
  ["bekende naam als voorvoegsel", "https://fcm.googleapis.com.evil.com/fcm/send/abc"],
  ["bekende naam zonder punt ervoor", "https://evilfcm.googleapis.com/x"],
  ["alleen het laatste deel", "https://googleapis.com/x"],
  ["hoofdletters in de host (ruwe tekst, …_310)", "https://FCM.GoogleAPIs.com/fcm/send/abc"],
  ["http", "http://fcm.googleapis.com/fcm/send/abc"],
  ["andere poort", "https://fcm.googleapis.com:8443/fcm/send/abc"],
  ["userinfo", "https://user:pass@fcm.googleapis.com/fcm/send/abc"],
  ["alleen gebruikersnaam", "https://evil@fcm.googleapis.com/fcm/send/abc"],
  ["userinfo die de host verbergt", "https://fcm.googleapis.com@evil.com/x"],
  ["puntkomma na de host", "https://evil.com;.fcm.googleapis.com/x"],
  ["puntkomma naar metadata-IP", "https://169.254.169.254;.fcm.googleapis.com/x"],
  ["puntkomma naar localhost", "https://localhost;.push.apple.com/x"],
  ["accolade in de host", "https://evil.com{.fcm.googleapis.com/x"],
  ["accolade in het pad", "https://fcm.googleapis.com/x{y}"],
  ["backtick", "https://evil.com`.fcm.googleapis.com/x"],
  ["enkel aanhalingsteken", "https://evil.com'.fcm.googleapis.com/x"],
  ["dubbel aanhalingsteken", 'https://evil.com".fcm.googleapis.com/x'],
  ["backslash in de host", "https://evil.com\\.fcm.googleapis.com/x"],
  ["backslash als padscheiding", "https://evil.com\\@fcm.googleapis.com/x"],
  ["spatie", "https://evil.com .fcm.googleapis.com/x"],
  ["zonder pad", "https://fcm.googleapis.com"],
  ["te lang", `https://fcm.googleapis.com/${"a".repeat(1000)}`],
  // D-044: het pad alleen zichtbare ASCII zonder " ' ; < > \ ` { }
  ["backtick in het pad", "https://fcm.googleapis.com/a`b"],
  ["enkel aanhalingsteken in het pad", "https://fcm.googleapis.com/a'b"],
  ["dubbel aanhalingsteken in het pad", 'https://fcm.googleapis.com/a"b'],
  ["backslash in het pad", "https://fcm.googleapis.com/a\\b"],
  ["< in het pad", "https://fcm.googleapis.com/a<b"],
  ["> in het pad", "https://fcm.googleapis.com/a>b"],
  ["puntkomma in het pad", "https://fcm.googleapis.com/a;b"],
  ["NBSP in het pad", "https://fcm.googleapis.com/a b"],
  ["BOM (U+FEFF) in het pad", "https://fcm.googleapis.com/a﻿b"],
  ["stuurteken chr(1) in het pad", "https://fcm.googleapis.com/a\u0001b"],
  ["spatie in het pad", "https://fcm.googleapis.com/a b"],
  ["é in het pad", "https://fcm.googleapis.com/café"],
  ["IP-adres", "https://127.0.0.1/x"],
  ["localhost", "https://localhost/x"],
  ["geen URL", "fcm.googleapis.com/fcm/send/abc"],
  ["leeg", ""],
  ["ander schema", "javascript:alert(1)"],
];

describe("isAllowedPushEndpoint", () => {
  it.each(TOEGESTAAN)("staat toe: %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each(GEWEIGERD)("weigert %s", (_naam, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it("alle toegestane padtekens (D-044) worden geaccepteerd: de klasse is niet te smal", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/aZ09-._~!#$%&()*+,/:=?@[]^_|")).toBe(true);
  });

  it("1001 tekens wordt geweigerd op de lengte, ook als het patroon wel past; 1000 mag", () => {
    const basis = "https://fcm.googleapis.com/";
    const te_lang = basis + "a".repeat(1001 - basis.length);
    expect(te_lang).toHaveLength(1001);
    expect(PUSH_ENDPOINT_PATTERN.test(te_lang)).toBe(true);
    expect(isAllowedPushEndpoint(te_lang)).toBe(false);
    expect(isAllowedPushEndpoint(basis + "a".repeat(1000 - basis.length))).toBe(true);
  });

  it("127.0.0.1.fcm.googleapis.com is bewust toegestaan (subdomein van de pushdienst) en beide parsers zien dezelfde host", () => {
    const e = "https://127.0.0.1.fcm.googleapis.com/x";
    expect(isAllowedPushEndpoint(e)).toBe(true);
    expect(parse(e).hostname).toBe("127.0.0.1.fcm.googleapis.com");
    expect(new URL(e).hostname).toBe("127.0.0.1.fcm.googleapis.com");
  });
});

describe("isAllowedPushEndpoint — eigenschap: geen parserverschil (security-review WP3, punt 1)", () => {
  /** Deterministische "willekeur" (vaste LCG): elke run dezelfde kandidaten */
  function* kandidaten(aantal: number): Generator<string> {
    let s = 20260929;
    const kies = <T,>(xs: T[]): T => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return xs[s % xs.length];
    };
    const voor = ["", "a.", "updates.", "web.", "wns2-db5p.", "evil.com", "evil.com;", "169.254.169.254;", "localhost;", "x@", "x:y@", "evil.com\\", "evil.com#", "evil.com?", "evil.com/", "%2e", "[::1]", "EVIL."];
    const hosts = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com", "FCM.googleapis.com", "fcm.googleapis.com.evil.com"];
    const tussen = ["", ".", ";", "{", "`", "'", '"', "\\", "@evil.com", ":443", ":8443", ":", "%00", " "];
    const paden = ["/", "/fcm/send/abc", "/w/?token=a", "/a;b", "/a{b}", "/a\\b", "", "/#frag", "/a@b", "/%2F..%2F"];
    for (let i = 0; i < aantal; i++) yield `https://${kies(voor)}${kies(hosts)}${kies(tussen)}${kies(paden)}`;
  }
  const PUSHDIENST = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;

  it("voor elk toegestaan endpoint geven url.parse (web-push) en new URL dezelfde host, en dat is een pushdienst", () => {
    let toegestaan = 0;
    for (const e of [...kandidaten(5000), ...TOEGESTAAN, ...GEWEIGERD.map(([, x]) => x)]) {
      if (!isAllowedPushEndpoint(e)) continue;
      toegestaan++;
      const whatwg = new URL(e).hostname;
      expect(parse(e).hostname, e).toBe(whatwg);
      expect(PUSHDIENST.test(whatwg), e).toBe(true);
      expect(PUSH_ENDPOINT_PATTERN.test(e), e).toBe(true);
    }
    // De generator levert ook echt toegestane gevallen; anders bewijst de test niets
    expect(toegestaan).toBeGreaterThan(50);
  });
});

describe("pushSubscriptionInput (validatie bij opslaan)", () => {
  const keys = { p256dh: "p256dh-sleutel", auth: "auth-sleutel" };

  it.each(TOEGESTAAN)("accepteert %s", (endpoint) => {
    expect(pushSubscriptionInput.safeParse({ endpoint, keys }).success).toBe(true);
  });

  it.each(GEWEIGERD.filter(([, e]) => e.startsWith("https://")))("weigert %s", (_naam, endpoint) => {
    expect(pushSubscriptionInput.safeParse({ endpoint, keys }).success).toBe(false);
  });
});
