"use client";

import { Check, Copy, Share2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useHousehold } from "@/features/household/store";
import { createInvitationAction } from "@/server/actions/household";
import { newId } from "@/lib/utils";
import type { MemberRole } from "@/types/database";

/** Uitnodiging maken voor een nieuw gezinslid. Toont daarna de link om te delen (UX §4.11). */
export function InviteForm() {
  const { snapshot, run } = useHousehold();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<MemberRole>("member");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  // Eén id per formulier: dubbel tikken maakt geen twee uitnodigingen
  const idRef = React.useRef(newId());

  const shareText = `${snapshot.me.display_name} nodigt je uit voor ${snapshot.household.name}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const data = await run(() => createInvitationAction({ id: idRef.current, email: email.trim() || null, role }));
    setBusy(false);
    if (data) setResult(data);
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      toast.success("Link gekopieerd");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopiëren lukte niet. Houd de link ingedrukt om hem te kopiëren.");
    }
  }

  async function share() {
    if (!result) return;
    try {
      await navigator.share({ title: "Uitnodiging Takenlijstje", text: shareText, url: result.url });
    } catch {
      // Delen geannuleerd: niets aan de hand
    }
  }

  const title = "Iemand uitnodigen";

  if (result) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Stuur deze link via WhatsApp, sms of mail. Met de link kan diegene een account maken en meedoen.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3">
          <Input readOnly value={result.url} onFocus={(e) => e.currentTarget.select()} aria-label="Uitnodigingslink" />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Gekopieerd" : "Kopiëren"}
            </Button>
            {canShare ? (
              <Button type="button" onClick={() => void share()}>
                <Share2 />
                Delen
              </Button>
            ) : (
              <Button type="button" asChild>
                <a href={`mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${shareText}: ${result.url}`)}`}>
                  <Share2 />
                  Mailen
                </a>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Geldig tot{" "}
            {new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: snapshot.household.timezone }).format(
              new Date(result.expiresAt),
            )}{" "}
            · werkt maar één keer.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Klaar
            </Button>
          </DialogClose>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={create} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Je krijgt een link die je kunt delen. Met een e-mailadres kan alleen dat adres de link gebruiken.</DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <Field label="E-mailadres (optioneel)" htmlFor="uitn-email">
          <Input
            id="uitn-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            placeholder="naam@voorbeeld.nl"
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Rol" htmlFor="uitn-rol">
          <NativeSelect id="uitn-rol" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
            <option value="member">Gezinslid</option>
            <option value="admin">Beheerder</option>
          </NativeSelect>
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Annuleren
          </Button>
        </DialogClose>
        <Button type="submit" disabled={busy}>
          {busy ? "Bezig…" : "Uitnodiging maken"}
        </Button>
      </DialogFooter>
    </form>
  );
}
