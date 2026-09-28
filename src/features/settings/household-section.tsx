"use client";

import { Home } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { SwitchRow } from "@/components/ui/switch";
import { useHousehold } from "@/features/household/store";
import { updateHouseholdAction } from "@/server/actions/household";
import { SettingsSection } from "./shared";

export function HouseholdSection() {
  const { snapshot, run } = useHousehold();
  const household = snapshot.household;
  const isAdmin = snapshot.me.role === "admin";

  const [name, setName] = React.useState(household.name);
  const [membersCanCreateTasks, setMembersCanCreateTasks] = React.useState(household.members_can_create_tasks);
  const [saving, setSaving] = React.useState(false);

  if (!isAdmin) {
    return (
      <SettingsSection id="huishouden" icon={Home} title="Huishouden">
        <p className="text-lg font-semibold">{household.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">Alleen een beheerder kan de instellingen van het huishouden aanpassen.</p>
      </SettingsSection>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await run(() => updateHouseholdAction({ name, membersCanCreateTasks }), { success: "Huishouden opgeslagen" });
    setSaving(false);
  }

  return (
    <SettingsSection id="huishouden" icon={Home} title="Huishouden" description="Naam en afspraken voor iedereen in huis.">
      <form onSubmit={save} className="grid gap-4">
        <Field label="Naam van het huishouden" htmlFor="hh-naam">
          <Input id="hh-naam" value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
        </Field>
        {/* Vast: Nederland (V-39) */}
        <Field label="Tijdzone" hint="Bepaalt wanneer een dag begint en wanneer herinneringen komen.">
          <p className="text-sm">Nederland (Amsterdam)</p>
        </Field>

        <div className="divide-y">
          <SwitchRow
            label="Gezinsleden mogen taken toevoegen"
            description="Anders kan alleen een beheerder nieuwe taken maken"
            checked={membersCanCreateTasks}
            onCheckedChange={setMembersCanCreateTasks}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Bezig…" : "Opslaan"}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
