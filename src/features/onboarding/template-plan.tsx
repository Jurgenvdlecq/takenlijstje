"use client";

/**
 * Bouwstenen om standaardtaken te activeren: kiezen welke taken, hoe vaak,
 * en hoe ze verdeeld worden. Gebruikt door de onboarding én de instellingen.
 */
import { CheckIcon } from "lucide-react";
import * as React from "react";
import type { ISODate } from "@/domain/dates";
import { describeRule, type RecurrenceRule } from "@/domain/recurrence/rule";
import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/input";
import { RecurrenceEditor, RULE_PRESETS } from "@/features/tasks/recurrence-editor";
import { CATEGORY_ICONS, CATEGORY_LABELS, STRATEGY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { AssignmentStrategy, MemberRow, TaskCategory, TemplateRow } from "@/types/database";

export type PlanMember = Pick<MemberRow, "id" | "display_name" | "color" | "icon" | "avatar_url" | "is_active">;

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
// 3. Hoe verdelen?
// ---------------------------------------------------------------------------
export interface Distribution {
  strategy: AssignmentStrategy;
  fixedMemberId: string | null;
  /** Per taak afwijkend: een strategie of "fixed:<memberId>" */
  overrides: Record<string, string>;
}

export const DEFAULT_DISTRIBUTION: Distribution = { strategy: "fair", fixedMemberId: null, overrides: {} };

const STRATEGY_ORDER: AssignmentStrategy[] = ["fair", "rotation", "random", "fixed", "none"];
const STRATEGY_EMOJI: Record<AssignmentStrategy, string> = {
  fair: "⚖️",
  rotation: "🔄",
  random: "🎲",
  fixed: "📌",
  none: "🙋",
};

export function DistributionPicker({
  members,
  templates,
  value,
  onChange,
}: {
  members: PlanMember[];
  templates: TemplateRow[];
  value: Distribution;
  onChange: (value: Distribution) => void;
}) {
  const active = members.filter((m) => m.is_active);
  const [showOverrides, setShowOverrides] = React.useState(Object.keys(value.overrides).length > 0);
  const fixedMemberId = value.fixedMemberId ?? active[0]?.id ?? null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-2" role="radiogroup" aria-label="Verdeling">
        {STRATEGY_ORDER.map((strategy) => {
          const selected = value.strategy === strategy;
          return (
            <button
              key={strategy}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ ...value, strategy, fixedMemberId: strategy === "fixed" ? fixedMemberId : value.fixedMemberId })}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 text-left transition",
                selected ? "border-primary bg-accent/60 ring-2 ring-primary/20" : "hover:bg-accent/40",
              )}
            >
              <span className="text-2xl" aria-hidden>
                {STRATEGY_EMOJI[strategy]}
              </span>
              <span className="grid flex-1 gap-0.5">
                <span className="font-medium">{STRATEGY_LABELS[strategy].label}</span>
                <span className="text-sm text-muted-foreground">{STRATEGY_LABELS[strategy].description}</span>
              </span>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border-2",
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                )}
              >
                {selected && <CheckIcon className="size-3.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      {value.strategy === "rotation" && active.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-muted/50 p-3 text-sm text-muted-foreground">
          Volgorde:
          {active.map((m, i) => (
            <span key={m.id} className="inline-flex items-center gap-1">
              {i > 0 && "→"}
              <MemberAvatar member={m} size="xs" /> {m.display_name}
            </span>
          ))}
        </p>
      )}

      {value.strategy === "fixed" && (
        <div className="grid gap-2 rounded-2xl bg-muted/50 p-3">
          <span className="text-sm font-medium">Wie doet alle taken?</span>
          <div className="flex flex-wrap gap-2">
            {active.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={fixedMemberId === m.id}
                onClick={() => onChange({ ...value, fixedMemberId: m.id })}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full border bg-card pr-4 pl-1.5 text-sm transition",
                  fixedMemberId === m.id && "border-primary bg-accent font-medium",
                )}
              >
                <MemberAvatar member={m} size="sm" />
                {m.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {templates.length > 1 && active.length > 1 && (
        <div className="grid gap-2">
          <button
            type="button"
            className="justify-self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setShowOverrides((v) => !v)}
          >
            {showOverrides ? "Verberg instellingen per taak" : "Per taak anders instellen (optioneel)"}
          </button>
          {showOverrides && (
            <ul className="grid gap-2">
              {templates.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
                  <span className="text-lg" aria-hidden>
                    {t.icon ?? "✨"}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{t.title}</span>
                  <NativeSelect
                    aria-label={`Verdeling voor ${t.title}`}
                    className="w-full sm:w-52"
                    value={value.overrides[t.id] ?? ""}
                    onChange={(e) => {
                      const overrides = { ...value.overrides };
                      if (e.target.value) overrides[t.id] = e.target.value;
                      else delete overrides[t.id];
                      onChange({ ...value, overrides });
                    }}
                  >
                    <option value="">Zoals hierboven</option>
                    {STRATEGY_ORDER.filter((s) => s !== "fixed").map((s) => (
                      <option key={s} value={s}>
                        {STRATEGY_LABELS[s].label}
                      </option>
                    ))}
                    {active.map((m) => (
                      <option key={m.id} value={`fixed:${m.id}`}>
                        Altijd {m.display_name}
                      </option>
                    ))}
                  </NativeSelect>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Samenvoegen tot invoer voor activateTemplatesAction
// ---------------------------------------------------------------------------
export function buildActivationItems(
  templates: TemplateRow[],
  rules: Record<string, RecurrenceRule>,
  distribution: Distribution,
  members: PlanMember[],
  startDate: ISODate,
) {
  const rotation = members.filter((m) => m.is_active).map((m) => m.id);
  const fallbackFixed = distribution.fixedMemberId ?? rotation[0] ?? null;
  return templates.map((t) => {
    const override = distribution.overrides[t.id];
    let strategy: AssignmentStrategy = distribution.strategy;
    let fixedMemberId: string | null = strategy === "fixed" ? fallbackFixed : null;
    if (override?.startsWith("fixed:")) {
      strategy = "fixed";
      fixedMemberId = override.slice("fixed:".length);
    } else if (override) {
      strategy = override as AssignmentStrategy;
      fixedMemberId = null;
    }
    return {
      templateId: t.id,
      rule: rules[t.id] ?? initialRule(t, startDate),
      timeOfDay: t.default_time ? t.default_time.slice(0, 5) : null,
      assignmentStrategy: strategy,
      fixedMemberId,
      rotationMemberIds: strategy === "rotation" ? rotation : [],
    };
  });
}
