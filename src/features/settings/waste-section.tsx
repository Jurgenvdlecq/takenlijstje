"use client";

/**
 * Instellingen › Afvalkalender in de huidige schermen (WP3b; UX §13.8,
 * §13.13.1; TECHNICAL_DESIGN §18.11). Toestanden A–J inline. Alle teksten
 * komen uit src/domain/waste/messages.ts (UX §13.16).
 */
import { CircleAlert, Recycle } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { formatPostcode } from "@/domain/waste/address";
import { WASTE_TEXT, wasteAdminsLine } from "@/domain/waste/messages";
import { useHousehold } from "@/features/household/store";
import { getWasteSettingsAction } from "@/server/actions/waste";
import type { WasteSettings } from "@/server/services/waste-read";
import { SettingsSection } from "./shared";
import { AddressFlow } from "./waste-address-flow";
import type { FormValues } from "./waste-shared";
import { StatusView } from "./waste-status";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; settings: WasteSettings };

export function WasteSection() {
  const { snapshot, online, refresh } = useHousehold();
  const [load, setLoad] = React.useState<Load>({ kind: "loading" });

  const fetchSettings = React.useCallback(
    () =>
      getWasteSettingsAction().then(
        (result): Load => (result.ok ? { kind: "ready", settings: result.data } : { kind: "error" }),
        (): Load => ({ kind: "error" }),
      ),
    [],
  );
  const reload = React.useCallback(async () => setLoad(await fetchSettings()), [fetchSettings]);

  React.useEffect(() => {
    let active = true;
    void fetchSettings().then((next) => active && setLoad(next));
    return () => {
      active = false;
    };
  }, [fetchSettings, snapshot.household.id, snapshot.me.id]);

  // Vanuit de storingsmelding: /instellingen/afvalkalender → #afvalkalender (AC-223)
  React.useEffect(() => {
    if (window.location.hash === "#afvalkalender") {
      document.getElementById("afvalkalender")?.scrollIntoView({ block: "start" });
    }
  }, [load.kind]);

  const failed = load.kind === "ready" && load.settings.role === "admin" && load.settings.enabled && load.settings.health.state === "failed";

  return (
    <SettingsSection
      id="afvalkalender"
      icon={Recycle}
      title="Afvalkalender"
      description={WASTE_TEXT.sectionDescription}
      action={
        failed ? (
          <span className="flex items-center gap-1 pt-0.5 text-sm text-muted-foreground">
            <CircleAlert className="size-4" aria-hidden />
            {WASTE_TEXT.notUpdated}
          </span>
        ) : undefined
      }
    >
      <div>
        {load.kind === "loading" && (
          <div className="grid gap-3" aria-busy="true" aria-label="Laden">
            <Skeleton className="h-6 w-2/5" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        )}
        {load.kind === "error" && (
          <div className="grid gap-3">
            <p className="text-sm">{WASTE_TEXT.loadFailed}</p>
            <div>
              <Button variant="outline" onClick={() => void reload()}>
                {WASTE_TEXT.reload}
              </Button>
            </div>
          </div>
        )}
        {load.kind === "ready" && load.settings.role === "member" && <MemberView settings={load.settings} />}
        {load.kind === "ready" && load.settings.role === "admin" && (
          <AdminView
            settings={load.settings}
            online={online}
            timeZone={snapshot.household.timezone}
            onChanged={async () => {
              await Promise.all([reload(), refresh()]);
            }}
            // Geen beheerder meer: opnieuw laden geeft de weergave van een gezinslid (J)
            onForbidden={() => void reload()}
          />
        )}
      </div>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// J: gezinslid
// ---------------------------------------------------------------------------

function MemberView({ settings }: { settings: Extract<WasteSettings, { role: "member" }> }) {
  return (
    <div className="grid gap-1">
      <p className="font-medium">{settings.enabled ? WASTE_TEXT.memberOnTitle : WASTE_TEXT.memberOffTitle}</p>
      <p className="text-sm text-muted-foreground">
        {settings.enabled ? WASTE_TEXT.memberOn : wasteAdminsLine(settings.adminNames)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Beheerder
// ---------------------------------------------------------------------------

function AdminView({
  settings,
  online,
  timeZone,
  onChanged,
  onForbidden,
}: {
  settings: Extract<WasteSettings, { role: "admin" }>;
  online: boolean;
  timeZone: string;
  onChanged: () => Promise<void>;
  onForbidden: () => void;
}) {
  const [editing, setEditing] = React.useState<FormValues | null>(null);

  if (!settings.enabled || editing) {
    return (
      <AddressFlow
        key={editing ? "wijzigen" : "aanzetten"}
        changing={settings.enabled}
        initial={editing ?? { postcode: "", houseNumber: "", suffix: "" }}
        online={online}
        onCancel={settings.enabled ? () => setEditing(null) : undefined}
        onForbidden={onForbidden}
        onSaved={async () => {
          setEditing(null);
          await onChanged();
        }}
      />
    );
  }

  const change = () =>
    setEditing({
      postcode: formatPostcode(settings.address.postcode),
      houseNumber: String(settings.address.houseNumber),
      suffix: settings.address.suffix,
    });

  return (
    <StatusView
      settings={settings}
      online={online}
      timeZone={timeZone}
      onChange={change}
      onChanged={onChanged}
      onForbidden={onForbidden}
    />
  );
}
