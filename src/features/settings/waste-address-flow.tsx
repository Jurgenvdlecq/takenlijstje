"use client";

/**
 * Instellingen › Afvalkalender: adres zoeken en bevestigen (UX §13.7.1,
 * §13.8.1, §13.9; TECHNICAL_DESIGN §18.11).
 */
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { formatPostcode, normalizeWasteAddress, POSTCODE_RE } from "@/domain/waste/address";
import { WASTE_TEXT, wasteChooseLine } from "@/domain/waste/messages";
import { WASTE_STREAMS } from "@/domain/waste/streams";
import type { ActionResult } from "@/server/errors";
import { confirmWasteAddressAction, lookupWasteAddressAction, type WasteLookupResult } from "@/server/actions/waste";
import { Emphasis, OfflineHint, PickupRow, type FormValues } from "./waste-shared";

type FormStep =
  | { kind: "form" }
  | { kind: "result"; result: Exclude<WasteLookupResult, { kind: "found" }> }
  | { kind: "found"; result: Extract<WasteLookupResult, { kind: "found" }>; saveFailed: boolean };

/** A, A′, B, C, C2, D, E, F, F2: adres zoeken en bevestigen */
export function AddressFlow({
  changing,
  initial,
  online,
  onCancel,
  onForbidden,
  onSaved,
}: {
  changing: boolean;
  initial: FormValues;
  online: boolean;
  onCancel?: () => void;
  onForbidden: () => void;
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
    const number = /^\s*(\d{1,5})/.exec(values.houseNumber);
    if (values.houseNumber.trim() && (!number || Number(number[1]) < 1)) {
      setErrors((e) => ({ ...e, houseNumber: WASTE_TEXT.houseNumberError }));
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
        // T-66, en de pagina wordt de weergave van een gezinslid (J)
        toast.error(WASTE_TEXT.adminOnly);
        onForbidden();
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
