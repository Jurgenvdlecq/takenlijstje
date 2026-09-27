"use client";

import { UserRound } from "lucide-react";
import * as React from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useHousehold } from "@/features/household/store";
import { updateMemberAction } from "@/server/actions/household";
import { ColorSwatches, EmojiPicker, SettingsSection } from "./shared";

export function ProfileSection() {
  const { snapshot, run } = useHousehold();
  const me = snapshot.me;
  const [displayName, setDisplayName] = React.useState(me.display_name);
  const [color, setColor] = React.useState(me.color);
  const [icon, setIcon] = React.useState(me.icon ?? "");
  const [saving, setSaving] = React.useState(false);

  const dirty = displayName.trim() !== me.display_name || color !== me.color || icon !== (me.icon ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await run(() => updateMemberAction(me.id, { displayName, color, icon: icon || null }), { success: "Profiel opgeslagen" });
    setSaving(false);
  }

  return (
    <SettingsSection id="profiel" icon={UserRound} title="Profiel" description="Zo zien de anderen jou in de app.">
      <form onSubmit={save} className="grid gap-5">
        <div className="flex items-center gap-3">
          <MemberAvatar member={{ display_name: displayName || "?", color, icon: icon || null, avatar_url: me.avatar_url }} size="xl" />
          <Field label="Jouw naam" htmlFor="profiel-naam" className="flex-1">
            <Input id="profiel-naam" value={displayName} maxLength={50} onChange={(e) => setDisplayName(e.target.value)} required />
          </Field>
        </div>
        <Field label="Kleur">
          <ColorSwatches value={color} onChange={setColor} />
        </Field>
        <Field label="Icoon">
          <EmojiPicker value={icon} onChange={setIcon} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || saving || !displayName.trim()}>
            {saving ? "Bezig…" : "Opslaan"}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
