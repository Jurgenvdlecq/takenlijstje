"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { SwitchRow } from "@/components/ui/switch";
import { useHousehold } from "@/features/household/store";
import { MEMBER_COLORS } from "@/lib/labels";
import { updateMemberAction } from "@/server/actions/household";
import type { MemberRole, MemberRow } from "@/types/database";
import { ColorSwatches, EmojiPicker } from "./shared";

/**
 * Formulier (in een dialoog) om een gezinslid te bewerken. Nieuwe gezinsleden
 * komen er alleen bij via een uitnodiging (V-21: geen leden zonder account).
 */
export function MemberForm({ member, onDone }: { member: MemberRow; onDone: (saved: MemberRow | null) => void }) {
  const { snapshot, run } = useHousehold();
  const isSelf = member.id === snapshot.me.id;

  const [displayName, setDisplayName] = React.useState(member.display_name);
  const [color, setColor] = React.useState(member.color ?? MEMBER_COLORS[0]);
  const [icon, setIcon] = React.useState(member.icon ?? "");
  const [role, setRole] = React.useState<MemberRole>(member.role);
  const [isActive, setIsActive] = React.useState(member.is_active);
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const saved = await run(
      () => updateMemberAction(member.id, { displayName, color, icon: icon || null, role, isActive }),
      { success: "Opgeslagen" },
    );
    setSaving(false);
    if (saved) onDone(saved);
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>{`${member.display_name} bewerken`}</DialogTitle>
        <DialogDescription>Pas naam, kleur of rol aan.</DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <Field label="Naam" htmlFor="lid-naam">
          <Input id="lid-naam" value={displayName} maxLength={50} required onChange={(e) => setDisplayName(e.target.value)} />
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
        {!isSelf && (
          <SwitchRow
            label="Actief"
            description="Uitgezet: kan tijdelijk niet meer in de app"
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
          {saving ? "Bezig…" : "Opslaan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
