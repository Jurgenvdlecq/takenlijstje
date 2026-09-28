"use client";

import { Library } from "lucide-react";
import * as React from "react";
import { todayIn } from "@/domain/dates";
import type { RecurrenceRule } from "@/domain/recurrence/rule";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHousehold } from "@/features/household/store";
import { buildActivationItems, FrequencyList, initialRule, TemplateChecklist } from "@/features/onboarding/template-plan";
import { newId } from "@/lib/utils";
import { activateTemplatesAction } from "@/server/actions/household";
import type { TemplateRow } from "@/types/database";
import { SettingsSection } from "./shared";

export function TemplatesSection() {
  const { snapshot } = useHousehold();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [open, setOpen] = React.useState(false);

  const activeIds = React.useMemo(
    () => new Set(snapshot.recurrences.filter((r) => r.is_active && r.template_id).map((r) => r.template_id as string)),
    [snapshot.recurrences],
  );
  const canCreate = snapshot.me.role === "admin" || snapshot.household.members_can_create_tasks;
  const chosen = snapshot.templates.filter((t) => selected.has(t.id) && !activeIds.has(t.id));

  return (
    <SettingsSection
      id="standaardtaken"
      icon={Library}
      title="Standaardtaken"
      description="Veelvoorkomende klusjes die je met één tik toevoegt."
    >
      <TemplateChecklist
        templates={snapshot.templates}
        selected={selected}
        activeIds={activeIds}
        onToggle={(id, checked) =>
          setSelected((s) => {
            const next = new Set(s);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
          })
        }
      />
      {canCreate && (
        <div className="sticky bottom-20 mt-4 flex justify-end">
          <Button size="lg" className="shadow-lg" disabled={chosen.length === 0} onClick={() => setOpen(true)}>
            {chosen.length === 0 ? "Kies taken om te activeren" : `${chosen.length} ${chosen.length === 1 ? "taak" : "taken"} activeren`}
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {open && (
            <ActivateFlow
              templates={chosen}
              onDone={() => {
                setOpen(false);
                setSelected(new Set());
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

function ActivateFlow({ templates, onDone }: { templates: TemplateRow[]; onDone: () => void }) {
  const { snapshot, run } = useHousehold();
  const today = todayIn(snapshot.household.timezone);
  const [rules, setRules] = React.useState<Record<string, RecurrenceRule>>(() =>
    Object.fromEntries(templates.map((t) => [t.id, initialRule(t, today)])),
  );
  const [saving, setSaving] = React.useState(false);
  // Vaste reeks-id's: dubbel tikken op "Activeren" maakt geen dubbele reeksen (R-03)
  const [recurrenceIds] = React.useState(() => new Map(templates.map((t) => [t.id, newId()])));

  async function activate() {
    setSaving(true);
    const items = buildActivationItems(templates, rules, today, (id) => recurrenceIds.get(id) ?? newId());
    const count = await run(() => activateTemplatesAction({ items }), {
      success: templates.length === 1 ? "Taak toegevoegd" : `${templates.length} taken toegevoegd`,
    });
    setSaving(false);
    if (count !== null) onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Hoe vaak?</DialogTitle>
        <DialogDescription>Kies per taak hoe vaak hij terugkomt.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <FrequencyList
          templates={templates}
          rules={rules}
          startDate={today}
          onChange={(id, rule) => setRules((r) => ({ ...r, [id]: rule }))}
        />
      </DialogBody>
      <DialogFooter>
        <Button onClick={() => void activate()} disabled={saving}>
          {saving ? "Bezig…" : "Activeren"}
        </Button>
      </DialogFooter>
    </>
  );
}
