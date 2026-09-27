"use client";

/**
 * Pushmeldingen op dít apparaat aan- of uitzetten.
 * Iedere telefoon/computer heeft een eigen abonnement.
 */
import { BellOff, BellRing, Info, Send, Share, Smartphone } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useHousehold } from "@/features/household/store";
import { publicEnv } from "@/lib/env";
import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestNotificationAction,
} from "@/server/actions/notifications";

interface DeviceInfo {
  supported: boolean;
  ios: boolean;
  standalone: boolean;
  permission: NotificationPermission | "unsupported";
}

const SERVER_INFO: DeviceInfo = { supported: false, ios: false, standalone: false, permission: "unsupported" };
let cachedInfo: DeviceInfo | null = null;

function readDeviceInfo(): DeviceInfo {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ua = navigator.userAgent;
  // iPadOS doet zich voor als Mac; herkenbaar aan het touchscherm
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  const info: DeviceInfo = { supported, ios, standalone, permission };
  // Zelfde object teruggeven zolang er niets veranderd is (vereist door useSyncExternalStore)
  if (
    cachedInfo &&
    cachedInfo.supported === info.supported &&
    cachedInfo.ios === info.ios &&
    cachedInfo.standalone === info.standalone &&
    cachedInfo.permission === info.permission
  ) {
    return cachedInfo;
  }
  cachedInfo = info;
  return info;
}

function subscribeDeviceInfo(onChange: () => void) {
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

function useDeviceInfo(): DeviceInfo {
  return React.useSyncExternalStore(subscribeDeviceInfo, readDeviceInfo, () => SERVER_INFO);
}

/** VAPID-sleutel (base64url) omzetten naar bytes voor pushManager.subscribe */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

export function PushDevice({
  pushEnabled,
  onPushEnabledChange,
}: {
  pushEnabled: boolean;
  onPushEnabledChange: (enabled: boolean) => Promise<boolean>;
}) {
  const { run } = useHousehold();
  const info = useDeviceInfo();
  const [subscribed, setSubscribed] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const configured = Boolean(publicEnv.vapidPublicKey);
  const needsHomeScreen = info.ios && !info.standalone;

  // Kijk of dit apparaat al een abonnement heeft
  React.useEffect(() => {
    if (!info.supported) return;
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .then((sub) => {
        if (!cancelled) setSubscribed(Boolean(sub));
      })
      .catch(() => {
        if (!cancelled) setSubscribed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [info.supported]);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Je hebt meldingen niet toegestaan", {
          description: "Zet meldingen voor deze app aan in de instellingen van je browser of telefoon.",
        });
        return;
      }
      const registration = await getRegistration();
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicEnv.vapidPublicKey),
        }));
      const saved = await run(() => savePushSubscriptionAction(JSON.parse(JSON.stringify(sub))), {
        success: "Meldingen staan aan op dit apparaat",
      });
      if (saved === null) {
        await sub.unsubscribe().catch(() => undefined);
        return;
      }
      setSubscribed(true);
    } catch (error) {
      console.error("[push] aanmelden mislukt", error);
      toast.error("Meldingen aanzetten is niet gelukt. Probeer het later opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await run(() => deletePushSubscriptionAction(endpoint));
      }
      setSubscribed(false);
      if (pushEnabled) await onPushEnabledChange(false);
      toast.success("Meldingen staan uit op dit apparaat");
    } catch (error) {
      console.error("[push] afmelden mislukt", error);
      toast.error("Meldingen uitzetten is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  const active = Boolean(subscribed) && info.permission !== "denied";

  return (
    <div className="grid gap-3 rounded-2xl border bg-muted/30 p-3">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-card p-2 text-muted-foreground">
          {active ? <BellRing className="size-5 text-primary" /> : <Smartphone className="size-5" />}
        </div>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-medium">Pushmeldingen op dit apparaat</span>
          <span className="text-xs text-muted-foreground">
            {!info.supported
              ? "Dit apparaat of deze browser ondersteunt geen pushmeldingen."
              : info.permission === "denied"
                ? "Meldingen zijn geblokkeerd in je browser."
                : active
                  ? "Aan – je krijgt meldingen, ook als de app dicht is."
                  : "Uit – je ziet meldingen alleen in de app."}
          </span>
        </div>
        <Switch
          aria-label="Pushmeldingen op dit apparaat"
          checked={active}
          disabled={busy || subscribed === null || !info.supported || !configured || info.permission === "denied" || needsHomeScreen}
          onCheckedChange={(checked) => void (checked ? enable() : disable())}
        />
      </div>

      {!configured && (
        <Hint icon={Info}>Pushmeldingen zijn op de server nog niet ingesteld. Vraag de beheerder van de app om dit te regelen.</Hint>
      )}

      {needsHomeScreen && (
        <Hint icon={Share}>
          Op een iPhone of iPad werken meldingen pas als je de app op je beginscherm zet (iOS 16.4 of nieuwer): tik in Safari
          op <strong>Deel</strong> en kies <strong>Zet op beginscherm</strong>. Open de app daarna vanaf je beginscherm.
        </Hint>
      )}

      {info.permission === "denied" && info.supported && (
        <Hint icon={BellOff}>
          Je hebt meldingen eerder geweigerd. Zet ze weer aan via de instellingen van je browser (het slotje naast het adres) of
          van je telefoon.
        </Hint>
      )}

      {active && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          disabled={busy}
          onClick={() => void run(() => sendTestNotificationAction(), { success: "Testmelding verstuurd" })}
        >
          <Send />
          Testmelding sturen
        </Button>
      )}
    </div>
  );
}

function Hint({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl bg-card p-3 text-xs leading-relaxed text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
