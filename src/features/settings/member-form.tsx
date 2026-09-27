"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { SwitchRow } from "@/components/ui/switch";
import { useHousehold } from "@/features/household/store";
import { MEMBER_COLORS } from "@/lib/labels";
import { addMemberAction, updateMemberAction } from "@/server/actions/household";
import type { MemberRole, MemberRow } from "@/types/database";
import { ColorSwatches, EmojiPicker } from "./shared";

/** Formulier (in een dialoog) om een gezinslid toe te voegen of te bewerken. */
export function MemberForm({ member, onDone }: { member?: MemberRow; onDone: (saved: MemberRow | null) => void }) {
  const { snapshot, run } = useHousehold();
  const editing = Boolean(member);
  const isSelf = member?.id === snapshot.me.id;

  const unusedColor = MEMBER_COLORS.find((c) => !snapshot.members.some((m) => m.color === c)) ?? MEMBER_COLORS[0];
  const [displayName, setDisplayName] = React.useState(member?.display_name ?? "");
  const [color, setColor] = React.useState(member?.color ?? unusedColor);
  const [icon, setIcon] = React.useState(member?.icon ?? "");
  const [role, setRole] = React.useState<MemberRole>(member?.role ?? "member");
  const [email, setEmail] = React.useState(member?.email ?? "");
  const [isActive, setIsActive] = React.useState(member?.is_active ?? true);
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const values = { displayName, color, icon: icon || null, role, email: email.trim() || null };
    const saved = member
      ? await run(() => updateMemberAction(member.id, { ...values, isActive }), { success: "Opgeslagen" })
      : await run(() => addMemberAction(values), { success: `${displayName.trim()} is toegevoegd` });
    setSaving(false);
    if (saved) onDone(saved);
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{editing ? `${member?.display_name} bewerken` : "Gezinslid toevoegen"}</DialogTitle>
        <DialogDescription>
          {editing ? "Pas naam, kleur of rol aan." : "Ook kinderen zonder telefoon kun je toevoegen. Uitnodigen om in te loggen kan later."}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <Field label="Naam" htmlFor="lid-naam">
          <Input id="lid-naam" value={displayName} maxLength={50} required autoFocus={!editing} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="Kleur">
          <ColorSwatches value={color} onChange={setColor} />
        </Field>
        <Field label="Icoon">
          <EmojiPicker value={icon} onChange={setIcon} />
        </Field>
        <Field
          label="Rol"
          htmlFor="lid-rol"
          hint={role === "admin" ? "Een beheerder kan alles instellen en gezinsleden beheren." : "Een gezinslid kan taken zien en afvinken."}
        >
          <NativeSelect id="lid-rol" value={role} disabled={isSelf} onChange={(e) => setRole(e.target.value as MemberRole)}>
            <option value="member">Gezinslid</option>
            <option value="admin">Beheerder</option>
          </NativeSelect>
        </Field>
        {!member?.user_id && (
          <Field label="E-mailadres (optioneel)" htmlFor="lid-email" hint="Handig om later een uitnodiging te sturen.">
            <Input id="lid-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        )}
        {editing && !isSelf && (
          <SwitchRow
            label="Actief"
            description="Niet-actieve gezinsleden krijgen geen nieuwe taken"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        )}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Annuleren
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving || !displayName.trim()}>
          {saving ? "Bezig…" : editing ? "Opslaan" : "Toevoegen"}
        </Button>
      </DialogFooter>
    </form>
  );
}
