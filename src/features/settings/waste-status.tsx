"use client";

/**
 * Instellingen › Afvalkalender: aan, hapering, storing en uitzetten
 * (UX §13.7.3–§13.7.6, §13.8.1, §13.8.2; TECHNICAL_DESIGN §18.11).
 */
import { CircleAlert, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isNewYearPeriod, type WasteHealth } from "@/domain/waste/health";
import {
  WASTE_TEXT,
  wasteAddressGoneExplain,
  wasteDisableText,
  wasteLastUpdatedLine,
  wasteNextYearNotice,
  wasteNotUpdatedSince,
  wasteRetryFailedLine,
  wasteStandHeading,
  wasteUpdatedLine,
} from "@/domain/waste/messages";
import { WASTE_STREAMS } from "@/domain/waste/streams";
import { useNow } from "@/hooks/use-now";
import { disableWasteCalendarAction, retryWasteSyncAction } from "@/server/actions/waste";
import type { WasteSettings } from "@/server/services/waste-read";
import { OfflineHint, PickupRow, readTipSeen, writeTipSeen } from "./waste-shared";

type AdminOn = Extract<WasteSettings, { enabled: true }>;

/** G, G′, G″, H, I: aan */
export function StatusView({
  settings,
  online,
  timeZone: tz,
  onChange,
  onChanged,
  onForbidden,
}: {
  settings: AdminOn;
  online: boolean;
  timeZone: string;
  onChange: () => void;
  onChanged: () => Promise<void>;
  onForbidden: () => void;
}) {
  const now = useNow();
  // Uitkomst van "Opnieuw proberen", zolang de geladen stand niet is ververst
  const [retried, setRetried] = React.useState<{ base: WasteHealth; health: WasteHealth } | null>(null);
  const health = retried && retried.base === settings.health ? retried.health : settings.health;
  const setHealth = (next: WasteHealth) => setRetried({ base: settings.health, health: next });
  const [retrying, setRetrying] = React.useState(false);
  const [retryLine, setRetryLine] = React.useState<string | null>(null);
  const [confirmOff, setConfirmOff] = React.useState(false);
  const [disabling, setDisabling] = React.useState(false);
  // Alleen in de browser gerenderd (na het laden van de instellingen), dus geen hydratieverschil
  const [tipSeen, setTipSeen] = React.useState(readTipSeen);

  const failed = health.state === "failed";
  const lastSuccessAt = health.lastSuccessAt;

  // Gesorteerd op datum; bakken zonder datum onderaan (UX §13.8.1)
  const rows = [...WASTE_STREAMS].sort((a, b) => {
    const da = settings.next[a];
    const db = settings.next[b];
    if (da === db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : 1;
  });

  async function retry() {
    setRetrying(true);
    setRetryLine(null);
    try {
      const result = await retryWasteSyncAction();
      if (!result.ok) {
        if (result.code === "FORBIDDEN") {
          toast.error(WASTE_TEXT.adminOnly);
          onForbidden();
        } else setRetryLine(wasteRetryFailedLine(new Date().toISOString(), tz));
        return;
      }
      if (result.data.kind === "too_soon") {
        // T-79 in de balk, geen melding onderin
        setRetryLine(WASTE_TEXT.tooSoon);
        return;
      }
      const next = result.data.health;
      setHealth(next);
      if (next.state === "ok") {
        toast(WASTE_TEXT.retried);
        await onChanged();
      } else if (next.state === "failed") {
        setRetryLine(wasteRetryFailedLine(result.data.attemptedAt, tz));
      } else {
        await onChanged();
      }
    } catch {
      setRetryLine(wasteRetryFailedLine(new Date().toISOString(), tz));
    } finally {
      setRetrying(false);
    }
  }

  async function disable() {
    setDisabling(true);
    try {
      const result = await disableWasteCalendarAction();
      if (result.ok) {
        setConfirmOff(false);
        toast(WASTE_TEXT.disabled);
        await onChanged();
      } else {
        toast.error(result.code === "FORBIDDEN" ? WASTE_TEXT.adminOnly : WASTE_TEXT.saveFailed);
        if (result.code === "FORBIDDEN") {
          setConfirmOff(false);
          onForbidden();
        }
      }
    } catch {
      toast.error(WASTE_TEXT.saveFailed);
    } finally {
      setDisabling(false);
    }
  }

  const quietLine =
    health.state === "retrying"
      ? health.lastErrorCode === "ADDRESS_GONE"
        ? WASTE_TEXT.retryingGone
        : WASTE_TEXT.retrying
      : health.state === "ok" && health.notice === "next_year_missing"
        ? wasteNextYearNotice(Number(new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: tz }).format(now)) + 1)
        : null;

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm">
          <strong className="font-semibold">{WASTE_TEXT.on}</strong>
          {" · "}
          {failed ? wasteLastUpdatedLine(lastSuccessAt, now, tz) : wasteUpdatedLine(lastSuccessAt, now, tz)}
        </p>
        {quietLine && <p className="mt-1 text-sm text-muted-foreground">{quietLine}</p>}
      </div>

      {failed && (
        <FailureBar
          health={health}
          now={now}
          tz={tz}
          address={settings.address.label}
          busy={retrying}
          online={online}
          resultLine={retryLine}
          onRetry={() => void retry()}
          onCheckAddress={onChange}
        />
      )}

      <div className="flex items-center justify-between gap-3 border-y py-2.5 text-sm">
        <span className="text-muted-foreground">{WASTE_TEXT.addressLabel}</span>
        <span className="flex items-center gap-3">
          <span className="font-medium">{settings.address.label}</span>
          <Button variant="link" className="h-auto px-0" aria-label={WASTE_TEXT.changeAria} disabled={!online} onClick={onChange}>
            {WASTE_TEXT.change}
          </Button>
        </span>
      </div>

      <div>
        <h3 className="border-b pb-2 text-sm font-semibold">
          {failed ? wasteStandHeading(lastSuccessAt, tz) : WASTE_TEXT.upcomingHeading}
        </h3>
        <dl className="divide-y">
          {rows.map((s) => (
            <PickupRow key={s} stream={s} date={settings.next[s]} />
          ))}
        </dl>
      </div>

      {!failed && <p className="text-sm text-muted-foreground">{WASTE_TEXT.explainOn}</p>}

      {!tipSeen && (
        <div className="flex items-start gap-2 rounded-2xl bg-muted p-4 text-sm">
          <p className="flex-1">{WASTE_TEXT.tipOldUi}</p>
          <button
            type="button"
            aria-label="Tip sluiten"
            className="-m-2 rounded-full p-2 text-muted-foreground hover:bg-accent"
            onClick={() => {
              writeTipSeen();
              setTipSeen(true);
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid gap-2">
        <div>
          <Button variant="outline" className="text-destructive" disabled={!online} onClick={() => setConfirmOff(true)}>
            {WASTE_TEXT.disable}
          </Button>
        </div>
        <OfflineHint online={online} />
      </div>

      <Dialog open={confirmOff} onOpenChange={(open) => !disabling && setConfirmOff(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{WASTE_TEXT.disableTitle}</DialogTitle>
            <DialogDescription className="sr-only">{wasteDisableText(settings.openTasks)}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm">{wasteDisableText(settings.openTasks)}</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" disabled={disabling} onClick={() => setConfirmOff(false)}>
              {WASTE_TEXT.cancel}
            </Button>
            <Button variant="destructive" disabled={disabling || !online} onClick={() => void disable()}>
              {disabling ? WASTE_TEXT.busy : WASTE_TEXT.disableConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FailureBar({
  health,
  now,
  tz,
  address,
  busy,
  online,
  resultLine,
  onRetry,
  onCheckAddress,
}: {
  health: WasteHealth;
  now: Date;
  tz: string;
  address: string;
  busy: boolean;
  online: boolean;
  resultLine: string | null;
  onRetry: () => void;
  onCheckAddress: () => void;
}) {
  const variant = health.variant ?? "H1";
  const title =
    variant === "H2" ? WASTE_TEXT.h2Title : variant === "H3" ? WASTE_TEXT.h3Title : wasteNotUpdatedSince(health.lastSuccessAt, tz);
  const explain =
    variant === "H2"
      ? isNewYearPeriod(now, tz)
        ? WASTE_TEXT.h2ExplainNewYear
        : WASTE_TEXT.h2ExplainOther
      : variant === "H3"
        ? wasteAddressGoneExplain(address)
        : WASTE_TEXT.h1Explain;

  return (
    <div role="status" className="grid grid-cols-[16px_1fr] gap-x-1.5 rounded-2xl bg-muted p-4 text-sm">
      <CircleAlert className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
      <div className="grid gap-2">
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{explain}</p>
        {resultLine && <p className="text-muted-foreground">{resultLine}</p>}
        <div className="flex flex-wrap gap-x-5">
          {variant === "H3" && (
            <Button variant="link" className="h-auto px-0" disabled={busy || !online} onClick={onCheckAddress}>
              {WASTE_TEXT.checkAddress}
            </Button>
          )}
          <Button variant="link" className="h-auto px-0" disabled={busy || !online} onClick={onRetry}>
            {busy ? WASTE_TEXT.busy : WASTE_TEXT.retry}
          </Button>
        </div>
        <OfflineHint online={online} />
      </div>
    </div>
  );
}
