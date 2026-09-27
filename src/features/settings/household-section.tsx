"use client";

import { Home } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { SwitchRow } from "@/components/ui/switch";
import { useHousehold } from "@/features/household/store";
import { updateHouseholdAction } from "@/server/actions/household";
import { SettingsSection } from "./shared";

const TIMEZONES = [
  { value: "Europe/Amsterdam", label: "Nederland (Amsterdam)" },
  { value: "Europe/Brussels", label: "België (Brussel)" },
  { value: "Europe/London", label: "Verenigd Koninkrijk (Londen)" },
  { value: "Europe/Berlin", label: "Duitsland (Berlijn)" },
  { value: "Europe/Paris", label: "Frankrijk (Parijs)" },
  { value: "Europe/Madrid", label: "Spanje (Madrid)" },
  { value: "Atlantic/Canary", label: "Canarische Eilanden" },
  { value: "America/Curacao", label: "Curaçao / Aruba / Bonaire" },
  { value: "America/Paramaribo", label: "Suriname (Paramaribo)" },
  { value: "America/New_York", label: "VS – oostkust (New York)" },
  { value: "UTC", label: "UTC" },
];

export function HouseholdSection() {
  const { snapshot, run } = useHousehold();
  const household = snapshot.household;
  const isAdmin = snapshot.me.role === "admin";

  const [name, setName] = React.useState(household.name);
  const [timezone, setTimezone] = React.useState(household.timezone);
  const [membersCanCreateTasks, setMembersCanCreateTasks] = React.useState(household.members_can_create_tasks);
  const [membersCanAssignOthers, setMembersCanAssignOthers] = React.useState(household.members_can_assign_others);
  const [pointsEnabled, setPointsEnabled] = React.useState(household.points_enabled);
  const [pointsGoal, setPointsGoal] = React.useState(household.points_goal?.toString() ?? "");
  const [pointsGoalReward, setPointsGoalReward] = React.useState(household.points_goal_reward ?? "");
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
    const goal = pointsGoal.trim() ? Math.round(Number(pointsGoal)) : null;
    await run(
      () =>
        updateHouseholdAction({
          name,
          timezone,
          membersCanCreateTasks,
          membersCanAssignOthers,
          pointsEnabled,
          pointsGoal: goal && goal > 0 ? goal : null,
          pointsGoalReward,
        }),
      { success: "Huishouden opgeslagen" },
    );
    setSaving(false);
  }

  const zones = TIMEZONES.some((z) => z.value === timezone) ? TIMEZONES : [{ value: timezone, label: timezone }, ...TIMEZONES];

  return (
    <SettingsSection id="huishouden" icon={Home} title="Huishouden" description="Naam en afspraken voor iedereen in huis.">
      <form onSubmit={save} className="grid gap-4">
        <Field label="Naam van het huishouden" htmlFor="hh-naam">
          <Input id="hh-naam" value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Tijdzone" htmlFor="hh-tijdzone" hint="Bepaalt wanneer een dag begint en wanneer herinneringen komen.">
          <NativeSelect id="hh-tijdzone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {zones.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <div className="divide-y">
          <SwitchRow
            label="Gezinsleden mogen taken toevoegen"
            description="Anders kan alleen een beheerder nieuwe taken maken"
            checked={membersCanCreateTasks}
            onCheckedChange={setMembersCanCreateTasks}
          />
          <SwitchRow
            label="Gezinsleden mogen taken aan anderen toewijzen"
            description="Anders alleen aan zichzelf"
            checked={membersCanAssignOthers}
            onCheckedChange={setMembersCanAssignOthers}
          />
          <SwitchRow
            label="Puntensysteem"
            description="Verdien punten met taken en spaar samen voor een beloning"
            checked={pointsEnabled}
            onCheckedChange={setPointsEnabled}
          />
        </div>

        {pointsEnabled && (
          <div className="grid gap-3 rounded-2xl bg-muted/50 p-3 sm:grid-cols-[8rem_1fr]">
            <Field label="Doel (punten)" htmlFor="hh-doel">
              <Input
                id="hh-doel"
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                value={pointsGoal}
                placeholder="100"
                onChange={(e) => setPointsGoal(e.target.value)}
              />
            </Field>
            <Field label="Beloning" htmlFor="hh-beloning">
              <Input
                id="hh-beloning"
                value={pointsGoalReward}
                maxLength={120}
                placeholder="Bijv. Filmavond 🍿"
                onChange={(e) => setPointsGoalReward(e.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Bezig…" : "Opslaan"}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
