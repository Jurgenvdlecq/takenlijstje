"use client";

/**
 * Instellingen › Afvalkalender in de huidige schermen (WP3b; UX §13.8,
 * §13.13.1; TECHNICAL_DESIGN §18.11). Toestanden A–J inline. Alle teksten
 * komen uit src/domain/waste/messages.ts (UX §13.16).
 */
import { CircleAlert, Recycle, X } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/misc";
import { formatPostcode, normalizeWasteAddress, POSTCODE_RE } from "@/domain/waste/address";
import { isNewYearPeriod, type WasteHealth } from "@/domain/waste/health";
import {
  formatWasteDay,
  WASTE_TEXT,
  wasteAddressGoneExplain,
  wasteAdminsLine,
  wasteChooseLine,
  wasteDisableText,
  wasteLastUpdatedLine,
  wasteNextYearNotice,
  wasteNotUpdatedSince,
  wasteRetryFailedLine,
  wasteStandHeading,
  wasteUpdatedLine,
} from "@/domain/waste/messages";
import { WASTE_STREAMS, type WasteStream } from "@/domain/waste/streams";
import { useHousehold } from "@/features/household/store";
import { useNow } from "@/hooks/use-now";
import type { ActionResult } from "@/server/errors";
import {
  confirmWasteAddressAction,
  disableWasteCalendarAction,
  getWasteSettingsAction,
  lookupWasteAddressAction,
  retryWasteSyncAction,
  type WasteLookupResult,
} from "@/server/actions/waste";
import type { WasteSettings } from "@/server/services/waste-read";
import { SettingsSection } from "./shared";

const TIP_KEY = "takenlijstje:afval-tip-gezien";

type AdminOn = Extract<WasteSettings, { enabled: true }>;
type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; settings: WasteSettings };

/** Bold-stukken (T-40, T-46) als afwisselend gewone en vette tekst */
function Emphasis({ parts }: { parts: readonly string[] }) {
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold">
            {part}
          </strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

function readTipSeen(): boolean {
  try {
    return window.localStorage.getItem(TIP_KEY) === "1";
  } catch {
    return false;
  }
}

function writeTipSeen() {
  try {
    window.localStorage.setItem(TIP_KEY, "1");
  } catch {
    // alleen gemak; zonder opslag komt de tip gewoon terug
  }
}

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
            onChanged={async () => {
              await Promise.all([reload(), refresh()]);
            }}
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

interface FormValues {
  postcode: string;
  houseNumber: string;
  suffix: string;
}

type FormStep =
  | { kind: "form" }
  | { kind: "result"; result: Exclude<WasteLookupResult, { kind: "found" }> }
  | { kind: "found"; result: Extract<WasteLookupResult, { kind: "found" }>; saveFailed: boolean };

function OfflineHint({ online }: { online: boolean }) {
  if (online) return null;
  return <p className="text-sm text-muted-foreground">{WASTE_TEXT.offline}</p>;
}

function AdminView({
  settings,
  online,
  onChanged,
}: {
  settings: Extract<WasteSettings, { role: "admin" }>;
  online: boolean;
  onChanged: () => Promise<void>;
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

  return <StatusView settings={settings} online={online} onChange={change} onChanged={onChanged} />;
}

// ---------------------------------------------------------------------------
// A, A′, B, C, C2, D, E, F, F2: adres zoeken en bevestigen
// ---------------------------------------------------------------------------

function AddressFlow({
  changing,
  initial,
  online,
  onCancel,
  onSaved,
}: {
  changing: boolean;
  initial: FormValues;
  online: boolean;
  onCancel?: () => void;
  onSaved: () => Promise<void>;
}) {
  const [values, setValues] = React.useState<FormValues>(initial);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormValues, string>>>({});
  const [step, setStep] = React.useState<FormStep>({ kind: "form" });
  const [busy, setBusy] = React.useState<"search" | "save" | null>(null);
  const [chosenSuffix, setChosenSuffix] = React.useState<string | null>(null);
  const router = useRouter();

  const set = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  function tidyPostcode() {
    const compact = values.postcode.toUpperCase().replace(/\s/g, "");
    if (POSTCODE_RE.test(compact)) setValues((v) => ({ ...v, postcode: formatPostcode(compact) }));
    else if (values.postcode.trim()) setErrors((e) => ({ ...e, postcode: WASTE_TEXT.postcodeError }));
  }

  function tidyHouseNumber() {
    const match = /^\s*(\d{1,5})\s*[-\s]?\s*([A-Za-z0-9]+)\s*$/.exec(values.houseNumber);
    if (match && !values.suffix.trim()) {
      setValues((v) => ({ ...v, houseNumber: match[1], suffix: match[2].toUpperCase() }));
    }
  }

  function validate(): FormValues | null {
    const normalized = normalizeWasteAddress({
      postcode: values.postcode,
      houseNumber: values.houseNumber,
      suffix: values.suffix.trim() ? values.suffix : null,
    });
    if (normalized.ok) {
      setErrors({});
      return values;
    }
    setErrors({
      postcode: normalized.errors.postcode ? WASTE_TEXT.postcodeError : undefined,
      houseNumber: normalized.errors.houseNumber ? WASTE_TEXT.houseNumberError : undefined,
      suffix: normalized.errors.suffix ? WASTE_TEXT.suffixError : undefined,
    });
    return null;
  }

  function input(suffix: string | null) {
    return { postcode: values.postcode, houseNumber: values.houseNumber, suffix };
  }

  /**
   * Voert een action uit. `handled` = de fout is al getoond (FORBIDDEN → T-66,
   * VALIDATION → veldfout); `failed` = onverwachte fout of geen verbinding.
   */
  async function handle<T>(action: () => Promise<ActionResult<T>>): Promise<{ data: T } | "handled" | "failed"> {
    try {
      const result = await action();
      if (result.ok) return { data: result.data };
      if (result.code === "FORBIDDEN") {
        toast.error(WASTE_TEXT.adminOnly);
        return "handled";
      }
      if (result.code === "VALIDATION") {
        validate();
        return "handled";
      }
      return "failed";
    } catch {
      return "failed";
    }
  }

  async function search(suffix: string | null = values.suffix.trim() ? values.suffix : null) {
    if (!validate()) return;
    setBusy("search");
    setChosenSuffix(suffix);
    const outcome = await handle(() => lookupWasteAddressAction(input(suffix)));
    setBusy(null);
    if (outcome === "handled") return;
    if (outcome === "failed") {
      setStep({ kind: "result", result: { kind: "unreachable" } });
      return;
    }
    const data = outcome.data;
    setStep(data.kind === "found" ? { kind: "found", result: data, saveFailed: false } : { kind: "result", result: data });
  }

  async function confirm(found: Extract<WasteLookupResult, { kind: "found" }>) {
    setBusy("save");
    const outcome = await handle(() => confirmWasteAddressAction(input(chosenSuffix ?? found.suffix)));
    setBusy(null);
    if (outcome === "handled") return;
    if (outcome === "failed") {
      setStep({ kind: "found", result: found, saveFailed: true });
      return;
    }
    const data = outcome.data;
    if (data.kind !== "saved") {
      setStep({ kind: "result", result: data });
      return;
    }
    if (data.mode === "enabled") {
      if (data.inserted > 0) {
        toast(WASTE_TEXT.savedEnabled, { action: { label: WASTE_TEXT.view, onClick: () => router.push("/kalender") } });
      } else {
        toast(WASTE_TEXT.savedEnabledNoTasks);
      }
    } else {
      toast(data.mode === "changed" ? WASTE_TEXT.savedChanged : WASTE_TEXT.savedUnchanged);
    }
    await onSaved();
  }

  const searching = busy === "search";
  const disabled = !online || busy !== null;

  // C: Klopt dit?
  if (step.kind === "found") {
    const found = step.result;
    return (
      <div className="grid gap-4">
        {step.saveFailed && (
          <p role="alert" className="text-sm text-destructive">
            {WASTE_TEXT.saveFailed}
          </p>
        )}
        <div>
          <h3 className="text-lg font-semibold">{WASTE_TEXT.confirmTitle}</h3>
          <p className="text-sm text-muted-foreground">{WASTE_TEXT.confirmSubtitle}</p>
        </div>
        <p className="font-semibold">{found.display}</p>
        <div>
          <h4 className="border-b pb-2 text-sm font-semibold">{WASTE_TEXT.nextPickupsHeading}</h4>
          <dl className="divide-y">
            {WASTE_STREAMS.map((s) => (
              <PickupRow key={s} stream={s} date={found.next[s]} />
            ))}
          </dl>
        </div>
        <p className="text-sm">
          <Emphasis parts={WASTE_TEXT.confirmExplain} />
        </p>
        {changing && <p className="text-sm text-muted-foreground">{WASTE_TEXT.changeReplace}</p>}
        <div className="grid gap-2">
          <Button disabled={disabled} onClick={() => void confirm(found)}>
            {busy === "save" ? WASTE_TEXT.busy : changing ? WASTE_TEXT.useAddress : WASTE_TEXT.enable}
          </Button>
          <OfflineHint online={online} />
          <Button variant="link" disabled={busy !== null} onClick={() => setStep({ kind: "form" })}>
            {WASTE_TEXT.otherAddress}
          </Button>
        </div>
      </div>
    );
  }

  // C2: meerdere adressen
  if (step.kind === "result" && step.result.kind === "choose") {
    const choose = step.result;
    return (
      <div className="grid gap-3">
        <p className="text-sm">{wasteChooseLine(choose.houseNumber)}</p>
        <ul className="divide-y rounded-xl border">
          {choose.candidates.map((c) => (
            <li key={c.suffix}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void search(c.suffix)}
                className="flex min-h-11 w-full items-center px-4 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
              >
                {c.display}
              </button>
            </li>
          ))}
        </ul>
        <OfflineHint online={online} />
        <div>
          <Button variant="link" className="px-0" onClick={() => setStep({ kind: "form" })}>
            {WASTE_TEXT.otherAddress}
          </Button>
        </div>
      </div>
    );
  }

  // E: geen bakken
  if (step.kind === "result" && step.result.kind === "no_streams") {
    return (
      <div className="grid gap-3">
        <p className="text-sm">{WASTE_TEXT.noStreams}</p>
        <div>
          <Button variant="outline" onClick={() => setStep({ kind: "form" })}>
            {WASTE_TEXT.otherAddress}
          </Button>
        </div>
      </div>
    );
  }

  const result = step.kind === "result" ? step.result.kind : null;

  // A / A′ met D, F of F2 boven het formulier
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void search();
      }}
    >
      {changing ? (
        <div>
          <h3 className="font-semibold">{WASTE_TEXT.changeTitle}</h3>
          <p className="text-sm text-muted-foreground">{WASTE_TEXT.changeLine}</p>
        </div>
      ) : (
        <p className="text-sm">
          <Emphasis parts={WASTE_TEXT.intro} />
        </p>
      )}

      {result === "not_found" && (
        <p role="alert" className="flex gap-1.5 text-sm font-medium text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {WASTE_TEXT.notFound}
        </p>
      )}
      {result === "unreachable" && (
        <div role="status" className="grid gap-2 rounded-2xl bg-muted p-4 text-sm">
          <p>{changing ? WASTE_TEXT.unreachableChange : WASTE_TEXT.unreachable}</p>
          <div>
            <Button type="button" variant="link" className="h-auto px-0" disabled={disabled} onClick={() => void search()}>
              {WASTE_TEXT.retry}
            </Button>
          </div>
        </div>
      )}
      {result === "no_upcoming" && (
        <p role="status" className="rounded-2xl bg-muted p-4 text-sm">
          {changing ? WASTE_TEXT.noUpcomingChange : WASTE_TEXT.noUpcoming}
        </p>
      )}

      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <Field label={WASTE_TEXT.postcodeLabel} htmlFor="afval-postcode" error={errors.postcode}>
          <Input
            id="afval-postcode"
            value={values.postcode}
            maxLength={7}
            autoComplete="postal-code"
            autoCapitalize="characters"
            placeholder={WASTE_TEXT.postcodePlaceholder}
            disabled={searching}
            aria-invalid={Boolean(errors.postcode)}
            onChange={set("postcode")}
            onBlur={tidyPostcode}
          />
        </Field>
        <Field label={WASTE_TEXT.houseNumberLabel} htmlFor="afval-huisnummer" error={errors.houseNumber}>
          <Input
            id="afval-huisnummer"
            value={values.houseNumber}
            maxLength={8}
            inputMode="text"
            disabled={searching}
            aria-invalid={Boolean(errors.houseNumber)}
            onChange={set("houseNumber")}
            onBlur={tidyHouseNumber}
          />
        </Field>
        <Field label={WASTE_TEXT.suffixLabel} htmlFor="afval-toevoeging" error={errors.suffix}>
          <Input
            id="afval-toevoeging"
            value={values.suffix}
            maxLength={4}
            autoCapitalize="characters"
            placeholder={WASTE_TEXT.suffixPlaceholder}
            disabled={searching}
            aria-invalid={Boolean(errors.suffix)}
            onChange={set("suffix")}
          />
        </Field>
      </div>

      {!changing && <p className="text-xs text-muted-foreground">{WASTE_TEXT.privacy}</p>}

      <div className="grid gap-2">
        <Button type="submit" disabled={disabled || !values.postcode.trim() || !values.houseNumber.trim()}>
          {searching ? WASTE_TEXT.searching : WASTE_TEXT.search}
        </Button>
        <OfflineHint online={online} />
        {onCancel && (
          <Button type="button" variant="link" disabled={busy !== null} onClick={onCancel}>
            {WASTE_TEXT.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}

function PickupRow({ stream, date }: { stream: WasteStream; date: string | null }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <dt className="text-muted-foreground">{WASTE_TEXT.streamLabels[stream]}</dt>
      <dd className={date ? "font-medium" : "text-muted-foreground"}>{date ? formatWasteDay(date) : WASTE_TEXT.noDateKnown}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// G, G′, G″, H, I: aan
// ---------------------------------------------------------------------------

function StatusView({
  settings,
  online,
  onChange,
  onChanged,
}: {
  settings: AdminOn;
  online: boolean;
  onChange: () => void;
  onChanged: () => Promise<void>;
}) {
  const now = useNow();
  const tz = "Europe/Amsterdam";
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
        if (result.code === "FORBIDDEN") toast.error(WASTE_TEXT.adminOnly);
        else setRetryLine(wasteRetryFailedLine(new Date().toISOString(), tz));
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
