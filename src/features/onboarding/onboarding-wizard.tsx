"use client";

/**
 * Welkomstwizard: huishouden aanmaken, standaardtaken kiezen en hoe vaak.
 * Er wordt niets verdeeld (V-21); gezinsleden komen erbij via een uitnodiging.
 * Draait buiten de HouseholdProvider, dus acties worden hier direct aangeroepen.
 */
import { ArrowLeft, ArrowRight, Loader2, PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { todayIn } from "@/domain/dates";
import type { RecurrenceRule } from "@/domain/recurrence/rule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Progress } from "@/components/ui/misc";
import { ColorSwatches } from "@/features/settings/shared";
import { MEMBER_COLORS } from "@/lib/labels";
import { newId } from "@/lib/utils";
import { activateTemplatesAction, completeOnboardingAction, createHouseholdAction } from "@/server/actions/household";
import type { ActionResult } from "@/server/errors";
import type { TemplateRow } from "@/types/database";
import { buildActivationItems, FrequencyList, TemplateChecklist } from "./template-plan";

type Step = "household" | "tasks" | "frequency" | "done";
const STEPS: Step[] = ["household", "tasks", "frequency"];

/** Server action aanroepen en fouten netjes tonen */
async function call<T>(action: () => Promise<ActionResult<T>>): Promise<T | null> {
  try {
    const result = await action();
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    return result.data;
  } catch {
    toast.error("Er ging iets mis. Controleer je verbinding en probeer het opnieuw.");
    return null;
  }
}

export function OnboardingWizard({
  household,
  templates,
  suggestedName,
}: {
  household: { id: string; name: string; timezone: string } | null;
  templates: TemplateRow[];
  suggestedName: string;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = React.useTransition();
  const [step, setStep] = React.useState<Step>(household ? "tasks" : "household");
  const [busy, setBusy] = React.useState(false);

  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(templates.filter((t) => t.popular).map((t) => t.id)));
  const [rules, setRules] = React.useState<Record<string, RecurrenceRule>>({});
  // Vaste reeks-id's per standaardtaak: dubbel tikken op "Klaar" maakt geen dubbele reeksen
  const recurrenceIds = React.useRef(new Map<string, string>());
  const idFor = (templateId: string) => {
    if (!recurrenceIds.current.has(templateId)) recurrenceIds.current.set(templateId, newId());
    return recurrenceIds.current.get(templateId)!;
  };

  const today = todayIn(household?.timezone ?? "Europe/Amsterdam");
  const chosen = templates.filter((t) => selected.has(t.id));
  // Bestond het huishouden al bij binnenkomst, dan telt stap 1 niet mee
  const [skipHousehold] = React.useState(household !== null);
  const visibleSteps = skipHousehold ? STEPS.slice(1) : STEPS;
  const index = visibleSteps.indexOf(step);

  const refresh = () => startRefresh(() => router.refresh());

  function go(next: Step) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finish() {
    setBusy(true);
    if (chosen.length > 0) {
      const items = buildActivationItems(chosen, rules, today, idFor);
      const count = await call(() => activateTemplatesAction({ items }));
      if (count === null) {
        setBusy(false);
        return;
      }
    }
    const done = await call(() => completeOnboardingAction());
    setBusy(false);
    if (done !== null) go("done");
  }

  if (step === "done") {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center animate-fade-up">
          <div className="rounded-full bg-accent p-5 text-accent-foreground">
            <PartyPopper className="size-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Je huishouden is klaar 🎉</h1>
          <p className="max-w-sm text-muted-foreground">
            {chosen.length > 0
              ? `${chosen.length} ${chosen.length === 1 ? "taak staat" : "taken staan"} ingepland. Nodig de anderen uit via Instellingen › Gezinsleden.`
              : "Voeg taken toe met de plusknop onderin. Nodig de anderen uit via Instellingen › Gezinsleden."}
          </p>
          <Button
            size="lg"
            className="mt-4 w-full max-w-xs"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
          >
            Naar mijn takenlijst
            <ArrowRight />
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 grid gap-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Stap {index + 1} van {visibleSteps.length}
          </span>
          {refreshing && <Loader2 className="size-4 animate-spin" aria-label="Bezig met laden" />}
        </div>
        <Progress value={(index + 1) / visibleSteps.length} />
      </div>

      {step === "household" && (
        <HouseholdStep
          suggestedName={suggestedName}
          onCreated={() => {
            refresh();
            go("tasks");
          }}
        />
      )}

      {step === "tasks" && (
        <StepLayout
          title="Welke taken wil je bijhouden?"
          subtitle="We hebben alvast wat populaire klusjes aangevinkt. Je kunt later altijd meer toevoegen."
          next={
            chosen.length > 0 ? (
              <Button size="lg" className="flex-1" onClick={() => go("frequency")}>
                Verder met {chosen.length} {chosen.length === 1 ? "taak" : "taken"}
                <ArrowRight />
              </Button>
            ) : (
              <Button size="lg" className="flex-1" disabled={busy} onClick={() => void finish()}>
                {busy ? "Bezig…" : "Overslaan en afronden"}
              </Button>
            )
          }
        >
          <TemplateChecklist
            templates={templates}
            selected={selected}
            onToggle={(id, checked) =>
              setSelected((s) => {
                const next = new Set(s);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              })
            }
          />
        </StepLayout>
      )}

      {step === "frequency" && (
        <StepLayout
          title="Hoe vaak?"
          subtitle="We stellen per taak iets voor. Pas het aan als het bij jullie anders gaat."
          back={() => go("tasks")}
          next={
            <Button size="lg" className="flex-1" disabled={busy} onClick={() => void finish()}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {busy ? "Taken inplannen…" : "Klaar!"}
            </Button>
          }
        >
          <FrequencyList
            templates={chosen}
            rules={rules}
            startDate={today}
            onChange={(id, rule) => setRules((r) => ({ ...r, [id]: rule }))}
          />
        </StepLayout>
      )}

    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="safe-top mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-8 pb-6">
      <div className="mb-6 flex items-center gap-2 font-semibold">
        <span aria-hidden className="text-xl">
          🏡
        </span>
        Takenlijstje
      </div>
      {children}
    </main>
  );
}

function StepLayout({
  title,
  subtitle,
  back,
  next,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: () => void;
  next: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col animate-fade-up">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      <div className="mt-6 flex-1">{children}</div>
      <div className="safe-bottom sticky bottom-0 -mx-4 mt-6 flex gap-2 border-t bg-background/90 px-4 pt-3 pb-3 backdrop-blur-md">
        {back && (
          <Button size="lg" variant="ghost" onClick={back} aria-label="Terug">
            <ArrowLeft />
          </Button>
        )}
        {next}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stap 1: huishouden
// ---------------------------------------------------------------------------
function HouseholdStep({ suggestedName, onCreated }: { suggestedName: string; onCreated: () => void }) {
  const [name, setName] = React.useState("");
  const [displayName, setDisplayName] = React.useState(suggestedName);
  const [color, setColor] = React.useState(MEMBER_COLORS[0]);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const id = await call(() => createHouseholdAction({ name, displayName, color }));
    setBusy(false);
    if (id) onCreated();
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col animate-fade-up">
      <h1 className="text-2xl font-bold tracking-tight">Welkom! 👋</h1>
      <p className="mt-1 text-muted-foreground">In een paar stappen staat jullie takenlijst klaar.</p>
      <div className="mt-6 grid flex-1 content-start gap-5">
        <Field label="Hoe heet je huishouden?" htmlFor="ob-huishouden" hint="Bijvoorbeeld “Familie Jansen” of “Huize Zonnebloem”.">
          <Input
            id="ob-huishouden"
            value={name}
            maxLength={80}
            required
            autoFocus
            placeholder="Familie Jansen"
            className="h-12 text-base"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Hoe heet jij?" htmlFor="ob-naam">
          <Input
            id="ob-naam"
            value={displayName}
            maxLength={50}
            required
            placeholder="Je voornaam"
            className="h-12 text-base"
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field label="Jouw kleur">
          <ColorSwatches value={color} onChange={setColor} />
        </Field>
      </div>
      <div className="safe-bottom sticky bottom-0 -mx-4 mt-6 border-t bg-background/90 px-4 pt-3 pb-3 backdrop-blur-md">
        <Button type="submit" size="lg" className="w-full" disabled={busy || !name.trim() || !displayName.trim()}>
          {busy ? "Bezig…" : "Volgende"}
          {!busy && <ArrowRight />}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Stap 2: gezinsleden
