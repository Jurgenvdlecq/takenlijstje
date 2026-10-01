"use client";

/**
 * Instellingen › Afvalkalender in de huidige schermen (W-03; UX_SPEC §13.7, §13.8,
 * §13.13; toestanden A–J). Alleen een beheerder ziet en beheert het adres; een
 * gezinslid ziet alleen of de afvalkalender aan staat (V-53). Alle acties zijn
 * online-only en gaan via de server; de app vraagt zelf nooit iets op bij de gemeente.
 */
import { CircleAlert, Recycle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ISODate } from "@/domain/dates";
import { formatPostcode, houseLabel, normalizePostcode, normalizeWasteAddress, type AddressField } from "@/domain/waste/address";
import { shortDay } from "@/domain/waste/messages";
import { STREAM_LABELS, WASTE_STREAMS, type WasteStream } from "@/domain/waste/streams";
import { useHousehold } from "@/features/household/store";
import {
  confirmWasteAddressAction,
  disableWasteCalendarAction,
  getWasteSettingsAction,
  lookupWasteAddressAction,
  retryWasteSyncAction,
  type WasteAddressInput,
  type WasteLookupResult,
} from "@/server/actions/waste";
import type { ActionResult } from "@/server/errors";
import type { WasteSettings } from "@/server/waste/read";
import { SettingsSection } from "./shared";

const OFFLINE_HINT = "Hiervoor heb je internet nodig";
const TIP_KEY = "afvalkalender-tip-weg";

const TEXT = {
  notFound:
    "Dit adres staat niet in de huisvuilkalender van Den Haag. Controleer postcode en huisnummer. De afvalkalender werkt alleen voor adressen in Den Haag.",
  noStreams:
    "Voor dit adres geeft de gemeente geen ophaaldagen voor restafval, papier of PMD. Gebruiken jullie een ondergrondse container? Dan hoeft er niets buiten te staan.",
  noUpcoming:
    "De gemeente heeft de ophaaldagen voor de komende weken nog niet online gezet. Er is niets opgeslagen. Probeer het later opnieuw.",
  unreachable: "De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen. Probeer het over een paar minuten opnieuw.",
  saveFailed: "Opslaan lukte niet. Er is niets veranderd. Probeer het opnieuw.",
  forbidden: "Alleen een beheerder kan de afvalkalender aanpassen. Er is niets veranderd.",
  offline: "Je bent offline. Er is niets veranderd.",
} as const;

/** "2026-10-06" → "di 6 okt" */
function day(date: ISODate): string {
  return shortDay(`${date}T12:00:00Z`, "UTC");
}

function clock(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(instant));
}

type View =
  | { step: "form" }
  | { step: "found"; result: Extract<WasteLookupResult, { kind: "found" }> }
  | { step: "choose"; options: { suffix: string; label: string }[] };

type Notice = { tone: "error" | "info"; text: string; retry?: boolean } | null;

/** Server action aanroepen; netwerkfout = null */
async function call<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T> | null> {
  try {
    return await action();
  } catch {
    return null;
  }
}

export function AfvalSection() {
  const { snapshot, online, refresh } = useHousehold();
  const isAdmin = snapshot.me.role === "admin";
  const tz = snapshot.household.timezone;
  const [settings, setSettings] = React.useState<WasteSettings | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);

  const load = React.useCallback(async () => {
    const result = await call(() => getWasteSettingsAction());
    if (result?.ok) {
      setSettings(result.data);
      setLoadFailed(false);
    } else {
      setLoadFailed(true);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const title = "Afvalkalender";
  if (!settings) {
    return (
      <SettingsSection id="afvalkalender" icon={Recycle} title={title}>
        {loadFailed ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">De afvalkalender kon niet worden geladen.</p>
            <Button variant="outline" size="sm" className="justify-self-start" onClick={() => void load()}>
              Opnieuw proberen
            </Button>
          </div>
        ) : (
          <div className="grid gap-2" aria-busy="true" aria-label="Laden">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
          </div>
        )}
      </SettingsSection>
    );
  }

  // J — gezinslid: alleen aan of uit
  if (settings.role === "member" || !isAdmin) {
    const enabled = settings.enabled;
    return (
      <SettingsSection id="afvalkalender" icon={Recycle} title={title}>
        <p className="text-sm font-medium">Afvalkalender staat {enabled ? "aan" : "uit"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {enabled ? "Ophaaldagen van de gemeente komen vanzelf als taak in de lijst." : "Een beheerder kan de afvalkalender aanzetten."}
        </p>
      </SettingsSection>
    );
  }

  return (
    <AdminAfval
      settings={settings}
      online={online}
      timeZone={tz}
      openWasteTasks={snapshot.tasks.filter((t) => t.waste_direction && (t.status === "todo" || t.status === "in_progress")).length}
      onChanged={async () => {
        await load();
        await refresh();
      }}
    />
  );
}

function AdminAfval({
  settings,
  online,
  timeZone,
  openWasteTasks,
  onChanged,
}: {
  settings: Extract<WasteSettings, { role: "admin" }>;
  online: boolean;
  timeZone: string;
  openWasteTasks: number;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(!settings.enabled);
  const [confirmOff, setConfirmOff] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [showTip, setShowTip] = React.useState(false);

  React.useEffect(() => {
    if (!settings.enabled) setEditing(true);
  }, [settings.enabled]);

  async function retry() {
    setBusy(true);
    const result = await call(() => retryWasteSyncAction());
    setBusy(false);
    if (!result) return toast.error(TEXT.offline);
    if (!result.ok) return toast.error(result.error);
    if (result.data.kind === "too_soon") return toast("Net geprobeerd. Probeer het over een minuut opnieuw.");
    await onChanged();
  }

  async function disable() {
    setBusy(true);
    const result = await call(() => disableWasteCalendarAction());
    setBusy(false);
    setConfirmOff(false);
    if (!result) return toast.error(TEXT.offline);
    if (!result.ok) return toast.error(result.code === "FORBIDDEN" ? TEXT.forbidden : result.error);
    toast("Afvalkalender staat uit");
    await onChanged();
  }

  if (editing) {
    return (
      <SettingsSection id="afvalkalender" icon={Recycle} title={settings.enabled ? "Ander adres" : "Afvalkalender"}>
        <AddressFlow
          changing={settings.enabled}
          initial={settings.enabled ? { postcode: settings.postcode, houseNumber: String(settings.houseNumber), suffix: settings.suffix } : null}
          online={online}
          onCancel={settings.enabled ? () => setEditing(false) : undefined}
          onSaved={async () => {
            if (!settings.enabled) {
              let hidden = false;
              try {
                hidden = window.localStorage.getItem(TIP_KEY) === "1";
              } catch {
                hidden = false;
              }
              setShowTip(!hidden);
            }
            setEditing(false);
            await onChanged();
          }}
        />
      </SettingsSection>
    );
  }

  if (!settings.enabled) return null;
  const failed = settings.health.state === "failed";
  const upcoming = WASTE_STREAMS.map((s) => [s, settings.next[s]] as const).sort(([, a], [, b]) => (a ?? "9999").localeCompare(b ?? "9999"));

  return (
    <SettingsSection id="afvalkalender" icon={Recycle} title="Afvalkalender">
      <div className="grid gap-4">
        {/* H — storing langer dan 48 uur (of aanhoudend leeg): rustige balk, geen rood */}
        {failed ? (
          <div role="status" className="grid gap-2 rounded-2xl bg-muted p-3.5">
            <p className="flex items-start gap-2 text-sm font-medium">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Niet bijgewerkt sinds {shortDay(settings.lastSuccessAt, timeZone)}.
            </p>
            <p className="text-sm text-muted-foreground">
              {settings.health.state === "failed" && settings.health.reason === "empty"
                ? "De gemeente geeft voor de komende twee weken geen ophaaldagen. De taken die er staan, blijven staan; nieuwe ophaaldagen komen er pas bij als het weer lukt."
                : "De gemeente-site gaf geen antwoord. De taken die er staan, blijven staan; nieuwe ophaaldagen komen er pas bij als het weer lukt."}
            </p>
            <Button variant="outline" size="sm" className="justify-self-start" disabled={busy || !online} onClick={() => void retry()}>
              {busy ? "Bezig…" : "Opnieuw proberen"}
            </Button>
            {!online && <p className="text-xs text-muted-foreground">{OFFLINE_HINT}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aan · bijgewerkt op {shortDay(settings.lastSuccessAt, timeZone)} {clock(settings.lastSuccessAt, timeZone)}
            {settings.health.state === "retrying" && " · de laatste poging lukte niet; de app probeert het vanzelf opnieuw."}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Adres</span>
            <span className="text-sm font-medium">
              {formatPostcode(settings.postcode)} {houseLabel(settings.houseNumber, settings.suffix)}
            </span>
          </div>
          <Button variant="ghost" size="sm" disabled={!online} onClick={() => setEditing(true)}>
            Wijzigen
          </Button>
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Volgende ophaaldagen{failed ? ` (stand ${shortDay(settings.lastSuccessAt, timeZone)})` : ""}</span>
          <ul className="grid gap-1">
            {upcoming.map(([stream, date]) => (
              <li key={stream} className="flex justify-between text-sm">
                <span>{STREAM_LABELS[stream]}</span>
                <span className={date ? "font-medium" : "text-muted-foreground"}>{date ? day(date) : "geen ophaaldag in de komende weken"}</span>
              </li>
            ))}
          </ul>
        </div>

        {showTip && (
          <div className="flex items-start gap-2 rounded-2xl border p-3 text-sm">
            <p className="flex-1">
              Had je zelf al een terugkerende afvaltaak? Die blijft gewoon staan. Stop hem via Taken › Terugkerend als je hem niet meer nodig hebt.
            </p>
            <button
              type="button"
              aria-label="Tip sluiten"
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              onClick={() => {
                setShowTip(false);
                try {
                  window.localStorage.setItem(TIP_KEY, "1");
                } catch {
                  // geen opslag beschikbaar: de tip verschijnt alleen na aanzetten
                }
              }}
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <Button variant="secondary" className="justify-self-start text-destructive" disabled={busy || !online} onClick={() => setConfirmOff(true)}>
          Afvalkalender uitzetten…
        </Button>
        {!online && <p className="text-xs text-muted-foreground">{OFFLINE_HINT}</p>}
        {notice && <p className="text-sm text-destructive">{notice.text}</p>}
      </div>

      {/* I — bevestiging uitzetten */}
      <Dialog open={confirmOff} onOpenChange={(open) => !busy && setConfirmOff(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Afvalkalender uitzetten?</DialogTitle>
            <DialogDescription>
              Het adres wordt gewist en de afvaltaken die nog open staan verdwijnen ({openWasteTasks} {openWasteTasks === 1 ? "taak" : "taken"}). Wat
              al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in.
            </DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmOff(false)}>
              Annuleren
            </Button>
            <Button variant="destructive" disabled={busy || !online} onClick={() => void disable().then(() => setNotice(null))}>
              {busy ? "Bezig…" : "Uitzetten"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

type FormValues = { postcode: string; houseNumber: string; suffix: string };
type FieldErrors = Partial<Record<AddressField, string>>;

/** A–F: adres invullen, opzoeken, kiezen en bevestigen ("Klopt dit?"). Er wordt nooit iets bewaard zonder bevestiging. */
function AddressFlow({
  changing,
  initial,
  online,
  onCancel,
  onSaved,
}: {
  changing: boolean;
  initial: FormValues | null;
  online: boolean;
  onCancel?: () => void;
  onSaved: () => Promise<void>;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<FormValues>(
    initial ? { ...initial, postcode: formatPostcode(initial.postcode) } : { postcode: "", houseNumber: "", suffix: "" },
  );
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [view, setView] = React.useState<View>({ step: "form" });
  const [busy, setBusy] = React.useState<"search" | "save" | null>(null);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [choice, setChoice] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const input = (suffixOverride?: string): WasteAddressInput => ({
    postcode: values.postcode,
    houseNumber: values.houseNumber,
    suffix: suffixOverride !== undefined ? suffixOverride : values.suffix.trim() ? values.suffix : null,
  });

  function validate(field?: AddressField): boolean {
    const result = normalizeWasteAddress(input());
    if (result.ok) {
      setErrors({});
      return true;
    }
    if (!field || field === result.field) setErrors({ [result.field]: result.message });
    return false;
  }

  function showOutcome(result: WasteLookupResult) {
    switch (result.kind) {
      case "found":
        setView({ step: "found", result });
        setNotice(null);
        return;
      case "choose":
        setView({ step: "choose", options: result.options });
        setChoice(null);
        setNotice(null);
        return;
      case "not_found":
        setView({ step: "form" });
        return setNotice({ tone: "error", text: TEXT.notFound });
      case "no_streams":
        setView({ step: "form" });
        return setNotice({ tone: "info", text: TEXT.noStreams });
      case "no_upcoming":
        setView({ step: "form" });
        return setNotice({ tone: "info", text: TEXT.noUpcoming, retry: true });
      case "unreachable":
        setView({ step: "form" });
        return setNotice({ tone: "error", text: TEXT.unreachable, retry: true });
    }
  }

  function failure(result: Extract<ActionResult<unknown>, { ok: false }> | null, fallback: string) {
    if (!result) return setNotice({ tone: "error", text: TEXT.offline });
    if (result.code === "FORBIDDEN") return setNotice({ tone: "error", text: TEXT.forbidden });
    if (result.code === "VALIDATION") return setNotice({ tone: "error", text: result.error });
    setNotice({ tone: "error", text: fallback });
  }

  async function search(suffixOverride?: string) {
    if (suffixOverride === undefined && !validate()) return;
    setBusy("search");
    setNotice(null);
    const result = await call(() => lookupWasteAddressAction(input(suffixOverride)));
    setBusy(null);
    if (!result || !result.ok) return failure(result, TEXT.unreachable);
    showOutcome(result.data);
  }

  async function confirm(found: Extract<WasteLookupResult, { kind: "found" }>) {
    setBusy("save");
    setNotice(null);
    const result = await call(() =>
      confirmWasteAddressAction({ postcode: found.address.postcode, houseNumber: found.address.houseNumber, suffix: found.address.suffix }),
    );
    setBusy(null);
    if (!result || !result.ok) return failure(result, TEXT.saveFailed);
    if (result.data.kind !== "saved") return showOutcome(result.data);
    if (changing) {
      toast("Nieuw adres opgeslagen · afvaltaken bijgewerkt");
    } else {
      toast("Afvalkalender staat aan · taken voor 2 weken klaargezet", {
        action: { label: "Bekijken", onClick: () => router.push("/kalender") },
      });
    }
    await onSaved();
  }

  const busyAny = busy !== null;
  const canSearch = online && !busyAny && values.postcode.trim() !== "" && values.houseNumber.trim() !== "";

  const noticeBlock = notice && (
    <div role={notice.tone === "error" ? "alert" : "status"} className="grid gap-2 rounded-2xl bg-muted p-3.5">
      <p className="flex items-start gap-2 text-sm">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {notice.text}
      </p>
      {notice.retry && (
        <Button variant="outline" size="sm" className="justify-self-start" disabled={!canSearch} onClick={() => void search()}>
          Opnieuw proberen
        </Button>
      )}
    </div>
  );

  // C — Klopt dit?
  if (view.step === "found") {
    const found = view.result;
    return (
      <div className="grid gap-4">
        {noticeBlock}
        <div className="grid gap-1">
          <p className="text-base font-semibold">Klopt dit?</p>
          <p className="text-sm">{found.display}</p>
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Eerstvolgende ophaaldagen</span>
          <ul className="grid gap-1">
            {WASTE_STREAMS.map((stream: WasteStream) => (
              <li key={stream} className="flex justify-between text-sm">
                <span>{STREAM_LABELS[stream]}</span>
                <span className={found.next[stream] ? "font-medium" : "text-muted-foreground"}>
                  {found.next[stream] ? day(found.next[stream]!) : "geen ophaaldag in de komende weken"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          De avond ervoor staat er een taak &ldquo;buitenzetten&rdquo; met een herinnering om 21:00. Op de ophaaldag vanaf 12:00 &ldquo;binnenzetten&rdquo;.
          {changing && " Open afvaltaken van het oude adres worden vervangen. Wat al gedaan is, blijft in de historie."}
        </p>
        <div className="grid gap-2">
          <Button disabled={busyAny || !online} onClick={() => void confirm(found)}>
            {busy === "save" ? "Bezig…" : changing ? "Ja, dit adres gebruiken" : "Ja, aanzetten"}
          </Button>
          <Button variant="ghost" disabled={busyAny} onClick={() => setView({ step: "form" })}>
            Ander adres
          </Button>
          {!online && <p className="text-xs text-muted-foreground">{OFFLINE_HINT}</p>}
        </div>
      </div>
    );
  }

  // C2 — meerdere adressen op dit nummer
  if (view.step === "choose") {
    const number = normalizeWasteAddress(input()).ok ? Number.parseInt(values.houseNumber, 10) : null;
    return (
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (choice !== null) void search(choice);
        }}
      >
        {noticeBlock}
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Op nummer {number ?? values.houseNumber} staan meerdere adressen. Welke is van jullie?</legend>
          {view.options.map((option) => (
            <label key={option.suffix || "-"} className="flex h-11 items-center gap-3 rounded-xl border px-3 text-sm">
              <input type="radio" name="afval-keuze" value={option.suffix} checked={choice === option.suffix} onChange={() => setChoice(option.suffix)} />
              {option.label}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-2">
          <Button type="submit" disabled={choice === null || busyAny || !online}>
            {busy === "search" ? "Zoeken…" : "Verder"}
          </Button>
          <Button type="button" variant="ghost" disabled={busyAny} onClick={() => setView({ step: "form" })}>
            Ander adres
          </Button>
        </div>
      </form>
    );
  }

  // A/B/D/E/F — formulier
  return (
    <form
      ref={formRef}
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (canSearch) void search();
      }}
    >
      {!changing && (
        <div className="grid gap-1 text-sm text-muted-foreground">
          <p>De app leest de huisvuilkalender van Den Haag en zet de taken zelf klaar:</p>
          <ul className="list-disc pl-5">
            <li>de avond ervoor: buitenzetten (herinnering om 21:00)</li>
            <li>op de ophaaldag: bak binnenzetten</li>
          </ul>
          <p>Voor restafval, papier en PMD.</p>
        </div>
      )}
      {changing && <p className="text-sm text-muted-foreground">Het huidige adres blijft gebruikt tot je het nieuwe bevestigt.</p>}
      {noticeBlock}
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <Field label="Postcode" htmlFor="afval-postcode" error={errors.postcode}>
          <Input
            id="afval-postcode"
            value={values.postcode}
            autoComplete="postal-code"
            autoCapitalize="characters"
            maxLength={7}
            placeholder="2517 AB"
            disabled={busyAny}
            aria-invalid={!!errors.postcode}
            onChange={(e) => setValues((v) => ({ ...v, postcode: e.target.value }))}
            onBlur={() => {
              const normalized = normalizePostcode(values.postcode);
              if (/^[1-9][0-9]{3}[A-Z]{2}$/.test(normalized)) setValues((v) => ({ ...v, postcode: formatPostcode(normalized) }));
              if (values.postcode.trim()) validate("postcode");
            }}
          />
        </Field>
        <Field label="Huisnummer" htmlFor="afval-huisnummer" error={errors.houseNumber}>
          <Input
            id="afval-huisnummer"
            value={values.houseNumber}
            inputMode="numeric"
            maxLength={8}
            disabled={busyAny}
            aria-invalid={!!errors.houseNumber}
            onChange={(e) => setValues((v) => ({ ...v, houseNumber: e.target.value }))}
            onBlur={() => values.houseNumber.trim() && validate("houseNumber")}
          />
        </Field>
      </div>
      <Field label="Toevoeging (optioneel)" htmlFor="afval-toevoeging" error={errors.suffix}>
        <Input
          id="afval-toevoeging"
          value={values.suffix}
          maxLength={4}
          placeholder="A of 2"
          autoCapitalize="characters"
          disabled={busyAny}
          aria-invalid={!!errors.suffix}
          onChange={(e) => setValues((v) => ({ ...v, suffix: e.target.value }))}
        />
      </Field>
      <div className="grid gap-2">
        <Button type="submit" disabled={!canSearch}>
          {busy === "search" ? "Zoeken…" : "Adres zoeken"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" disabled={busyAny} onClick={onCancel}>
            Annuleren
          </Button>
        )}
        {!online && <p className="text-xs text-muted-foreground">{OFFLINE_HINT}</p>}
        <p className="text-xs text-muted-foreground">Alleen postcode en huisnummer gaan naar de gemeente. Alleen beheerders zien het adres.</p>
      </div>
    </form>
  );
}
