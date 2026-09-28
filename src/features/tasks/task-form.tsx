"use client";

/**
 * Taakformulier voor nieuw en wijzigen.
 * Eenvoudig: Naam · Wanneer?  — alles anders onder "Meer instellingen".
 * Bij een nieuwe taak wordt de naam slim gelezen: "Badkamer zaterdag".
 * Taken horen bij het huishouden; er is geen "Wie?" (V-21).
 */
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import * as React from "react";
import { todayIn, type ISODate } from "@/domain/dates";
import { parseQuickAdd } from "@/domain/quick-add/parser";
import { describeRule, type RecurrenceRule } from "@/domain/recurrence/rule";
import { PRIORITY_LABELS, type Priority } from "@/domain/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSnapshot } from "@/features/household/store";
import { CATEGORY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TaskCategory } from "@/types/database";
import { defaultRule, RecurrenceEditor, RULE_PRESETS } from "./recurrence-editor";
import { REMINDER_OPTIONS, WhenPicker } from "./task-form-fields";

export interface TaskFormValues {
  title: string;
  description: string;
  category: TaskCategory;
  priority: Priority;
  date: ISODate;
  time: string;
  dueDate: string;
  dueTime: string;
  availableDaysBefore: number;
  duration: string;
  reminder: string;
  recurring: boolean;
  rule: RecurrenceRule;
  templateId: string | null;
}

export function emptyValues(today: ISODate): TaskFormValues {
  return {
    title: "",
    description: "",
    category: "other",
    priority: "normal",
    date: today,
    time: "",
    dueDate: "",
    dueTime: "",
    availableDaysBefore: 0,
    duration: "",
    reminder: "",
    recurring: false,
    rule: defaultRule("weekly", today),
    templateId: null,
  };
}

export function TaskForm({
  initial,
  smartTitle,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
  lockRecurring,
}: {
  initial: TaskFormValues;
  /** Snelle invoer ontleden (alleen bij nieuwe taken) */
  smartTitle?: boolean;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
  /** Bij bewerken van een reeks-taak: herhaling aanwezig maar wordt apart bevestigd */
  lockRecurring?: boolean;
}) {
  const snapshot = useSnapshot();
  const today = todayIn(snapshot.household.timezone);
  const [values, setValues] = React.useState(initial);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [more, setMore] = React.useState(false);
  const titleId = React.useId();

  const templates = React.useMemo(
    () => snapshot.templates.map((t) => ({ id: t.id, title: t.title, keywords: t.keywords })),
    [snapshot.templates],
  );

  // Slimme invoer: wat de gebruiker typt wordt gelezen, tenzij hij het veld zelf koos
  const parsed = React.useMemo(
    () =>
      smartTitle && values.title.trim()
        ? parseQuickAdd(values.title, {
            today,
            // Geen personen herkennen: taken horen bij het huishouden (V-21)
            members: [],
            templates,
          })
        : null,
    [smartTitle, values.title, today, templates],
  );

  const effective: TaskFormValues = React.useMemo(() => {
    if (!parsed) return values;
    const template = parsed.templateId ? snapshot.templates.find((t) => t.id === parsed.templateId) : undefined;
    return {
      ...values,
      title: parsed.title || values.title,
      date: !touched.date && parsed.date ? parsed.date : values.date,
      time: !touched.time && parsed.time ? parsed.time : values.time,
      priority: !touched.priority && parsed.priority ? parsed.priority : values.priority,
      recurring: !touched.recurring && parsed.rule ? true : values.recurring,
      rule: !touched.rule && parsed.rule ? parsed.rule : values.rule,
      category: !touched.category && template ? template.category : values.category,
      duration: !touched.duration && template?.duration_minutes ? String(template.duration_minutes) : values.duration,
      templateId: template?.id ?? null,
    };
  }, [parsed, values, touched, snapshot.templates]);

  /** Handmatige keuze: vastleggen vanaf wat er nu (slim) getoond wordt */
  function update(patch: Partial<TaskFormValues>) {
    setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(patch).map((k) => [k, true])) }));
    setValues((v) => ({ ...effective, title: v.title, ...patch }));
  }

  function set<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    update({ [key]: value } as Partial<TaskFormValues>);
  }

  const recognized = parsed
    ? [
        parsed.templateId || (parsed.title && parsed.title !== values.title.trim()) ? `“${parsed.title}”` : null,
        parsed.date ? new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${parsed.date}T12:00:00Z`)) : null,
        parsed.time,
        parsed.rule ? describeRule(parsed.rule).toLowerCase() : null,
        parsed.priority ? PRIORITY_LABELS[parsed.priority].toLowerCase() : null,
      ].filter(Boolean)
    : [];

  const titleValid = effective.title.trim().length > 0;

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (titleValid) onSubmit(effective);
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor={titleId}>Naam taak</Label>
        <Input
          id={titleId}
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
          maxLength={80}
          placeholder={smartTitle ? "Bijv. Badkamer zaterdag" : "Naam van de taak"}
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
        />
        {recognized.length > 1 || (recognized.length === 1 && parsed?.templateId) ? (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Herkend:
            {recognized.map((r) => (
              <Badge key={r} variant="primary">
                {r}
              </Badge>
            ))}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label>Wanneer?</Label>
        <WhenPicker today={today} value={effective.date} onChange={(d) => set("date", d)} />
      </div>

      {!lockRecurring && (
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`${titleId}-rec`}>Herhalen</Label>
            <Switch
              id={`${titleId}-rec`}
              checked={effective.recurring}
              onCheckedChange={(checked) => update({ recurring: checked })}
            />
          </div>
          {effective.recurring && (
            <>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
                {RULE_PRESETS.map((preset) => {
                  const rule = preset.build(effective.date);
                  const active = JSON.stringify(rule) === JSON.stringify(effective.rule);
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => set("rule", rule)}
                      className={cn(
                        "h-9 shrink-0 rounded-full border px-3 text-sm transition",
                        active ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:bg-muted",
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <RecurrenceEditor value={effective.rule} onChange={(r) => set("rule", r)} startDate={effective.date} />
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
        className="flex items-center gap-1.5 justify-self-start rounded-full px-1 py-2 text-sm font-medium text-primary"
      >
        <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />
        Meer instellingen
      </button>

      {more && (
        <div className="grid gap-4 animate-fade-up">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categorie">
              <NativeSelect value={effective.category} onChange={(e) => set("category", e.target.value as TaskCategory)}>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Prioriteit">
              <NativeSelect value={effective.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Tijdstip">
              <Input type="time" value={effective.time} onChange={(e) => set("time", e.target.value)} />
            </Field>
            <Field label="Duur (minuten)">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                placeholder="Bijv. 15"
                value={effective.duration}
                onChange={(e) => set("duration", e.target.value)}
              />
            </Field>
            <Field label="Uiterlijk (deadline)" hint="Leeg = einde van de dag">
              <Input type="date" min={effective.date} value={effective.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </Field>
            <Field label="Deadline-tijd">
              <Input type="time" value={effective.dueTime} onChange={(e) => set("dueTime", e.target.value)} />
            </Field>
            <Field label="Beschikbaar vanaf">
              <NativeSelect
                value={String(effective.availableDaysBefore)}
                onChange={(e) => set("availableDaysBefore", Number(e.target.value))}
              >
                <option value="0">Op de dag zelf</option>
                <option value="1">1 dag eerder</option>
                <option value="2">2 dagen eerder</option>
                <option value="3">3 dagen eerder</option>
                <option value="7">Een week eerder</option>
              </NativeSelect>
            </Field>
            <Field label="Herinnering">
              <NativeSelect value={effective.reminder} onChange={(e) => set("reminder", e.target.value)}>
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Field label="Omschrijving">
            <Textarea
              maxLength={1000}
              placeholder="Bijv. ook de spiegel en de kraan"
              value={effective.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t bg-card px-5 pt-3 pb-1 safe-bottom">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 sm:flex-none">
          Annuleren
        </Button>
        <Button type="submit" disabled={!titleValid || busy} className="flex-1">
          {busy && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
