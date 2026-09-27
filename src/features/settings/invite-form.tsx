"use client";

import { Check, Copy, Share2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useHousehold } from "@/features/household/store";
import { createInvitationAction } from "@/server/actions/household";
import type { MemberRole, MemberRow } from "@/types/database";

/**
 * Uitnodiging maken voor een bestaand gezinslid zonder account
 * of voor een nieuw persoon. Toont daarna de link om te delen.
 */
export function InviteForm({ member }: { member: MemberRow | null }) {
  const { snapshot, run } = useHousehold();
  const [email, setEmail] = React.useState(member?.email ?? "");
  const [role, setRole] = React.useState<MemberRole>(member?.role ?? "member");
  const [sendEmail, setSendEmail] = React.useState(Boolean(member?.email));
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ url: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const hasEmail = email.trim().length > 0;
  const shareText = `${snapshot.me.display_name} nodigt je uit voor ${snapshot.household.name}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const data = await run(() =>
      createInvitationAction({ memberId: member?.id ?? null, email: email.trim() || null, role, sendEmail: sendEmail && hasEmail }),
    );
    setBusy(false);
    if (!data) return;
    setResult(data);
    if (sendEmail && hasEmail) {
      if (data.emailed) toast.success(`Inloglink gemaild naar ${email.trim()}`);
      else toast.error("De e-mail kon niet worden verstuurd. Deel de link hieronder zelf.");
    }
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

  const title = member ? `${member.display_name} uitnodigen` : "Iemand uitnodigen";

  if (result) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Stuur deze link via WhatsApp, sms of mail. Met de link kan {member?.display_name ?? "diegene"} inloggen en meedoen.
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
          <p className="text-xs text-muted-foreground">De link is een tijdje geldig en werkt maar één keer.</p>
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
        <DialogDescription>Je krijgt een link die je kunt delen. Het e-mailadres is optioneel.</DialogDescription>
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
        {!member && (
          <Field label="Rol" htmlFor="uitn-rol">
            <NativeSelect id="uitn-rol" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
              <option value="member">Gezinslid</option>
              <option value="admin">Beheerder</option>
            </NativeSelect>
          </Field>
        )}
        {hasEmail && (
          <label className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm">
            <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} />
            Stuur ook een inloglink per e-mail
          </label>
        )}
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
