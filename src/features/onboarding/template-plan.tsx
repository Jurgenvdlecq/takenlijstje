"use client";

/**
 * Bouwstenen om standaardtaken te activeren: kiezen welke taken en hoe vaak.
 * Gebruikt door de onboarding én de instellingen.
 */
import { CheckIcon } from "lucide-react";
import * as React from "react";
import type { ISODate } from "@/domain/dates";
import { describeRule, type RecurrenceRule } from "@/domain/recurrence/rule";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/input";
import { RecurrenceEditor, RULE_PRESETS } from "@/features/tasks/recurrence-editor";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TaskCategory, TemplateRow } from "@/types/database";

const CATEGORY_ORDER: TaskCategory[] = ["cleaning", "kitchen", "laundry", "groceries", "outdoor", "pets", "admin", "other"];

/** Standaardregel van de standaardtaak, anders wekelijks op de startdag */
export function initialRule(template: TemplateRow, startDate: ISODate): RecurrenceRule {
  return template.default_rule ?? RULE_PRESETS[1].build(startDate);
}

export function groupByCategory(templates: TemplateRow[]): { category: TaskCategory; items: TemplateRow[] }[] {
  return CATEGORY_ORDER.map((category) => ({ category, items: templates.filter((t) => t.category === category) })).filter(
    (g) => g.items.length > 0,
  );
}

// ---------------------------------------------------------------------------
// 1. Welke taken?
// ---------------------------------------------------------------------------
export function TemplateChecklist({
  templates,
  selected,
  onToggle,
  activeIds,
}: {
  templates: TemplateRow[];
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  /** Standaardtaken die al lopen (worden gemarkeerd en niet opnieuw aangeboden) */
  activeIds?: Set<string>;
}) {
  return (
    <div className="grid gap-5">
      {groupByCategory(templates).map(({ category, items }) => {
        const Icon = CATEGORY_ICONS[category];
        return (
          <fieldset key={category} className="grid gap-2">
            <legend className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
              <Icon className="size-4" />
              {CATEGORY_LABELS[category]}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((t) => {
                const active = activeIds?.has(t.id) ?? false;
                const checked = selected.has(t.id);
                return (
                  <label
                    key={t.id}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border bg-card p-3 transition",
                      checked && "border-primary bg-accent/60",
                      active && "cursor-default opacity-70",
                    )}
                  >
                    <Checkbox checked={checked} disabled={active} onCheckedChange={(v) => onToggle(t.id, v === true)} />
                    <span className="text-xl" aria-hidden>
                      {t.icon ?? "✨"}
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-sm font-medium">{t.title}</span>
                      {t.default_rule && <span className="text-xs text-muted-foreground">{describeRule(t.default_rule)}</span>}
                    </span>
                    {active && (
                      <Badge variant="done">
                        <CheckIcon />
                        Actief
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Hoe vaak?
// ---------------------------------------------------------------------------
export function FrequencyList({
  templates,
  rules,
  onChange,
  startDate,
}: {
  templates: TemplateRow[];
  rules: Record<string, RecurrenceRule>;
  onChange: (templateId: string, rule: RecurrenceRule) => void;
  startDate: ISODate;
}) {
  return (
    <ul className="grid gap-2">
      {templates.map((t) => (
        <FrequencyRow
          key={t.id}
          template={t}
          rule={rules[t.id] ?? initialRule(t, startDate)}
          onChange={(rule) => onChange(t.id, rule)}
          startDate={startDate}
        />
      ))}
    </ul>
  );
}

function FrequencyRow({
  template,
  rule,
  onChange,
  startDate,
}: {
  template: TemplateRow;
  rule: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  startDate: ISODate;
}) {
  const [choice, setChoice] = React.useState(() => {
    const described = describeRule(rule);
    if (template.default_rule && describeRule(template.default_rule) === described) return "template";
    const preset = RULE_PRESETS.findIndex((p) => describeRule(p.build(startDate)) === described);
    return preset >= 0 ? `p${preset}` : "custom";
  });

  function select(value: string) {
    setChoice(value);
    if (value === "template" && template.default_rule) onChange(template.default_rule);
    else if (value.startsWith("p")) onChange(RULE_PRESETS[Number(value.slice(1))].build(startDate));
  }

  return (
    <li className="grid gap-2 rounded-2xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xl" aria-hidden>
          {template.icon ?? "✨"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{template.title}</span>
          <span className="block text-xs text-muted-foreground">{describeRule(rule)}</span>
        </span>
        <NativeSelect aria-label={`Hoe vaak: ${template.title}`} value={choice} onChange={(e) => select(e.target.value)} className="w-full sm:w-48">
          {template.default_rule && <option value="template">Aanbevolen: {describeRule(template.default_rule)}</option>}
          {RULE_PRESETS.map((p, i) => (
            <option key={p.label} value={`p${i}`}>
              {p.label}
            </option>
          ))}
          <option value="custom">Aangepast…</option>
        </NativeSelect>
      </div>
      {choice === "custom" && <RecurrenceEditor value={rule} onChange={onChange} startDate={startDate} />}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Samenvoegen tot invoer voor activateTemplatesAction
// ---------------------------------------------------------------------------
/** @param idFor vaste reeks-id per standaardtaak (dubbel versturen = één reeks) */
export function buildActivationItems(
  templates: TemplateRow[],
  rules: Record<string, RecurrenceRule>,
  startDate: ISODate,
  idFor: (templateId: string) => string,
) {
  return templates.map((t) => ({
    recurrenceId: idFor(t.id),
    templateId: t.id,
    rule: rules[t.id] ?? initialRule(t, startDate),
    timeOfDay: t.default_time ? t.default_time.slice(0, 5) : null,
  }));
}
