"use client";

import { SlidersHorizontal, X } from "lucide-react";
import * as React from "react";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/domain/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { MemberRow } from "@/types/database";
import { activeFilterCount, DEFAULT_FILTERS, type TaskFilters } from "@/features/tasks/selectors";

/** Filtervenster: persoon, categorie, status, prioriteit, terugkerend en periode. */
export function TaskFiltersButton({
  filters,
  onChange,
  members,
}: {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
  members: MemberRow[];
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(filters);
  const count = activeFilterCount(filters);
  const set = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <>
      <Button
        variant={count ? "secondary" : "outline"}
        size="icon"
        aria-label={`Filters${count ? ` (${count} actief)` : ""}`}
        onClick={() => {
          setDraft(filters);
          setOpen(true);
        }}
        className="relative"
      >
        <SlidersHorizontal />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {count}
          </span>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid grid-cols-2 gap-3">
            <Field label="Persoon" className="col-span-2">
              <NativeSelect value={draft.memberId} onChange={(e) => set("memberId", e.target.value)}>
                <option value="all">Iedereen</option>
                <option value="unassigned">Niet toegewezen</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Status">
              <NativeSelect value={draft.status} onChange={(e) => set("status", e.target.value as TaskFilters["status"])}>
                <option value="open">Open (incl. verlopen)</option>
                <option value="all">Alles</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Categorie">
              <NativeSelect value={draft.category} onChange={(e) => set("category", e.target.value)}>
                <option value="all">Alle</option>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Prioriteit">
              <NativeSelect value={draft.priority} onChange={(e) => set("priority", e.target.value)}>
                <option value="all">Alle</option>
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Terugkerend">
              <NativeSelect value={draft.recurring} onChange={(e) => set("recurring", e.target.value as TaskFilters["recurring"])}>
                <option value="all">Alle</option>
                <option value="yes">Alleen terugkerend</option>
                <option value="no">Alleen eenmalig</option>
              </NativeSelect>
            </Field>
            <Field label="Vanaf">
              <Input type="date" value={draft.from ?? ""} onChange={(e) => set("from", e.target.value || null)} />
            </Field>
            <Field label="Tot en met">
              <Input type="date" value={draft.to ?? ""} onChange={(e) => set("to", e.target.value || null)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft({ ...DEFAULT_FILTERS, search: draft.search })}>
              <X /> Wissen
            </Button>
            <Button
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Toon resultaten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
