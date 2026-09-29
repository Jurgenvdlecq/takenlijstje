import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "../push-endpoints";
import { pushSubscriptionInput } from "../validation";

/**
 * Push-endpoint-allowlist (security-review WP1, technische schuld WP3): alleen de
 * pushdiensten van de browsers, via https op poort 443 en zonder inloggegevens.
 */
describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://web.push.apple.com/QGx1c3Q",
    "https://wns2-db5p.notify.windows.com/w/?token=abc",
    "https://FCM.GoogleAPIs.com/fcm/send/abc",
    "https://fcm.googleapis.com:443/fcm/send/abc",
  ])("staat toe: %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ["andere host", "https://evil.com/fcm/send/abc"],
    ["bekende naam als voorvoegsel", "https://fcm.googleapis.com.evil.com/fcm/send/abc"],
    ["bekende naam zonder punt ervoor", "https://evilfcm.googleapis.com/x"],
    ["alleen het laatste deel", "https://googleapis.com/x"],
    ["http", "http://fcm.googleapis.com/fcm/send/abc"],
    ["andere poort", "https://fcm.googleapis.com:8443/fcm/send/abc"],
    ["userinfo", "https://user:pass@fcm.googleapis.com/fcm/send/abc"],
    ["alleen gebruikersnaam", "https://evil@fcm.googleapis.com/fcm/send/abc"],
    ["userinfo die de host verbergt", "https://fcm.googleapis.com@evil.com/x"],
    ["IP-adres", "https://127.0.0.1/x"],
    ["localhost", "https://localhost/x"],
    ["geen URL", "fcm.googleapis.com/fcm/send/abc"],
    ["leeg", ""],
    ["ander schema", "javascript:alert(1)"],
  ])("weigert %s", (_naam, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});

describe("pushSubscriptionInput (validatie bij opslaan)", () => {
  const keys = { p256dh: "p256dh-sleutel", auth: "auth-sleutel" };

  it("accepteert een abonnement bij een bekende pushdienst", () => {
    expect(pushSubscriptionInput.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }).success).toBe(true);
  });

  it.each([
    "https://evil.com/fcm/send/abc",
    "https://fcm.googleapis.com.evil.com/fcm/send/abc",
    "https://user:pass@fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/fcm/send/abc",
    "http://fcm.googleapis.com/fcm/send/abc",
  ])("weigert %s", (endpoint) => {
    expect(pushSubscriptionInput.safeParse({ endpoint, keys }).success).toBe(false);
  });
});
