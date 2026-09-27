"use client";

import { Bell } from "lucide-react";
import * as React from "react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SwitchRow } from "@/components/ui/switch";
import { useHousehold } from "@/features/household/store";
import { savePreferencesAction } from "@/server/actions/notifications";
import type { PreferencesRow } from "@/types/database";
import { PushDevice } from "./push-device";
import { SettingsSection } from "./shared";

export interface PreferencesForm {
  pushEnabled: boolean;
  notifyTaskAssigned: boolean;
  notifyReminders: boolean;
  notifyDeadlineSoon: boolean;
  notifyOverdue: boolean;
  notifyTaskCompleted: boolean;
  notifySwapRequests: boolean;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
  eveningSummaryEnabled: boolean;
  eveningSummaryTime: string;
  deadlineWarningMinutes: number;
}

/** Zelfde standaardwaarden als in de database */
function toForm(p: PreferencesRow | null): PreferencesForm {
  return {
    pushEnabled: p?.push_enabled ?? false,
    notifyTaskAssigned: p?.notify_task_assigned ?? true,
    notifyReminders: p?.notify_reminders ?? true,
    notifyDeadlineSoon: p?.notify_deadline_soon ?? true,
    notifyOverdue: p?.notify_overdue ?? true,
    notifyTaskCompleted: p?.notify_task_completed ?? false,
    notifySwapRequests: p?.notify_swap_requests ?? true,
    dailySummaryEnabled: p?.daily_summary_enabled ?? true,
    dailySummaryTime: (p?.daily_summary_time ?? "07:30").slice(0, 5),
    eveningSummaryEnabled: p?.evening_summary_enabled ?? true,
    eveningSummaryTime: (p?.evening_summary_time ?? "20:00").slice(0, 5),
    deadlineWarningMinutes: p?.deadline_warning_minutes ?? 120,
  };
}

const WARNING_OPTIONS = [
  { value: 30, label: "30 minuten van tevoren" },
  { value: 60, label: "1 uur van tevoren" },
  { value: 120, label: "2 uur van tevoren" },
  { value: 240, label: "4 uur van tevoren" },
  { value: 1440, label: "1 dag van tevoren" },
];

const TOGGLES: { key: keyof PreferencesForm; label: string; description: string }[] = [
  { key: "notifyTaskAssigned", label: "Nieuwe taak voor mij", description: "Als iemand je een taak geeft" },
  { key: "notifyReminders", label: "Herinneringen", description: "Op het tijdstip dat je bij een taak kiest" },
  { key: "notifyDeadlineSoon", label: "Deadline nadert", description: "Een seintje vlak voor de deadline" },
  { key: "notifyOverdue", label: "Te laat", description: "Als een taak van jou over tijd is" },
  { key: "notifyTaskCompleted", label: "Taak afgerond door een ander", description: "Zie wanneer iemand iets heeft gedaan" },
  { key: "notifySwapRequests", label: "Ruilverzoeken", description: "Als iemand een taak met je wil ruilen" },
];

export function NotificationsSection() {
  const { snapshot, run } = useHousehold();
  const [form, setForm] = React.useState(() => toForm(snapshot.preferences));

  // Push-status kan ook elders wijzigen (bijv. na aanmelden op dit apparaat)
  const serverPush = snapshot.preferences?.push_enabled ?? false;
  const [lastServerPush, setLastServerPush] = React.useState(serverPush);
  if (serverPush !== lastServerPush) {
    setLastServerPush(serverPush);
    setForm((f) => ({ ...f, pushEnabled: serverPush }));
  }

  /** Direct opslaan bij elke wijziging; bij een fout terug naar de vorige stand. */
  const save = async (changes: Partial<PreferencesForm>) => {
    const previous = form;
    const next = { ...form, ...changes };
    setForm(next);
    const result = await run(() => savePreferencesAction(next));
    if (result === null) setForm(previous);
    return result !== null;
  };

  return (
    <SettingsSection id="meldingen" icon={Bell} title="Meldingen" description="Kies waarover je een seintje wilt krijgen.">
      <div className="grid gap-4">
        <PushDevice pushEnabled={form.pushEnabled} onPushEnabledChange={(pushEnabled) => save({ pushEnabled })} />

        <div className="divide-y">
          {TOGGLES.map((t) => (
            <SwitchRow
              key={t.key}
              label={t.label}
              description={t.description}
              checked={form[t.key] as boolean}
              onCheckedChange={(checked) => void save({ [t.key]: checked })}
            />
          ))}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="deadline-waarschuwing">Waarschuwing voor een deadline</Label>
          <NativeSelect
            id="deadline-waarschuwing"
            value={form.deadlineWarningMinutes}
            disabled={!form.notifyDeadlineSoon}
            onChange={(e) => void save({ deadlineWarningMinutes: Number(e.target.value) })}
          >
            {!WARNING_OPTIONS.some((o) => o.value === form.deadlineWarningMinutes) && (
              <option value={form.deadlineWarningMinutes}>{form.deadlineWarningMinutes} minuten van tevoren</option>
            )}
            {WARNING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-1 rounded-2xl bg-muted/50 p-3">
          <SummaryRow
            label="Ochtendoverzicht"
            description="Wat er vandaag voor je klaarstaat"
            enabled={form.dailySummaryEnabled}
            time={form.dailySummaryTime}
            onEnabledChange={(dailySummaryEnabled) => void save({ dailySummaryEnabled })}
            onTimeChange={(dailySummaryTime) => void save({ dailySummaryTime })}
          />
          <SummaryRow
            label="Avondoverzicht"
            description="Wat er nog openstaat en wat morgen komt"
            enabled={form.eveningSummaryEnabled}
            time={form.eveningSummaryTime}
            onEnabledChange={(eveningSummaryEnabled) => void save({ eveningSummaryEnabled })}
            onTimeChange={(eveningSummaryTime) => void save({ eveningSummaryTime })}
          />
        </div>
      </div>
    </SettingsSection>
  );
}

function SummaryRow({
  label,
  description,
  enabled,
  time,
  onEnabledChange,
  onTimeChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  time: string;
  onEnabledChange: (enabled: boolean) => void;
  onTimeChange: (time: string) => void;
}) {
  const id = React.useId();
  const [draft, setDraft] = React.useState(time);
  const [lastTime, setLastTime] = React.useState(time);
  if (time !== lastTime) {
    setLastTime(time);
    setDraft(time);
  }
  return (
    <div>
      <SwitchRow label={label} description={description} checked={enabled} onCheckedChange={onEnabledChange} />
      {enabled && (
        <div className="flex items-center gap-2 pb-2">
          <label htmlFor={id} className="text-sm text-muted-foreground">
            Om
          </label>
          <Input
            id={id}
            type="time"
            value={draft}
            className="w-32"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (/^\d{2}:\d{2}$/.test(draft) && draft !== time) onTimeChange(draft);
            }}
          />
        </div>
      )}
    </div>
  );
}
