"use client";

import { Archive, ChevronDown, MoreHorizontal, Plus, ShoppingBasket, Sparkles } from "lucide-react";
import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { EmptyState, Progress, SectionTitle } from "@/components/ui/misc";
import { useHousehold } from "@/features/household/store";
import { SHOPPING_CATEGORY_EMOJI, SHOPPING_CATEGORY_LABELS } from "@/lib/labels";
import { cn, newId } from "@/lib/utils";
import { archiveShoppingListAction } from "@/server/actions/shopping";
import type { ShoppingCategory, ShoppingItemRow } from "@/types/database";
import { EditItemDialog } from "./edit-item-dialog";
import { guessCategory, parseShoppingInput, SHOPPING_CATEGORY_ORDER } from "./parse";
import { ShoppingItem } from "./shopping-item";
import { useShoppingSuggestions } from "./use-suggestions";

/** Vanaf dit aantal gekochte items klapt "In je mandje" standaard in */
const BASKET_COLLAPSE_FROM = 6;

export function ShoppingPage() {
  const { snapshot, mutate, run } = useHousehold();
  const [editing, setEditing] = React.useState<ShoppingItemRow | null>(null);
  const [archiving, setArchiving] = React.useState(false);

  const items = snapshot.shoppingItems;
  const open = items.filter((i) => !i.is_bought);
  const bought = items
    .filter((i) => i.is_bought)
    .sort((a, b) => (b.bought_at ?? "").localeCompare(a.bought_at ?? ""));
  const allDone = items.length > 0 && open.length === 0;

  const groups = SHOPPING_CATEGORY_ORDER.map((category) => ({
    category,
    items: open.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);

  const suggestions = useShoppingSuggestions(
    snapshot.household.id,
    items.map((i) => i.name),
  );

  const add = (name: string, quantity: string | null, category: ShoppingCategory) =>
    mutate("shoppingAdd", { id: newId(), name, quantity, category, note: null });

  const archive = async () => {
    setArchiving(true);
    await run(() => archiveShoppingListAction(), { success: "Lijst afgerond" });
    setArchiving(false);
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        className="mb-0"
        title="Boodschappen"
        subtitle={
          items.length === 0
            ? "Samen één lijst, altijd bij de hand"
            : open.length === 0
              ? "Alles is gehaald"
              : `${open.length} ${open.length === 1 ? "product" : "producten"} te halen`
        }
        actions={
          bought.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Lijstopties">
                  <MoreHorizontal className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={archiving} onSelect={() => void archive()}>
                  <Archive />
                  Lijst afronden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />

      <div className="grid gap-3">
        <QuickAdd onAdd={add} />
        {items.length > 0 && <Progress value={bought.length / items.length} className="h-1.5" />}
      </div>

      {suggestions.length > 0 && (
        <section aria-label="Vaak gekocht" className="min-w-0">
          <SectionTitle>
            <Sparkles className="size-3.5" />
            Vaak gekocht
          </SectionTitle>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {suggestions.map((s) => (
              <button
                key={s.name.toLowerCase()}
                type="button"
                onClick={() => void add(s.name, null, s.category)}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium shadow-xs transition hover:border-primary/40 hover:bg-accent active:scale-[0.97]"
              >
                <span aria-hidden>{SHOPPING_CATEGORY_EMOJI[s.category]}</span>
                {s.name}
                <Plus className="size-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>
      )}

      {allDone && (
        <Card className="flex flex-col items-center gap-3 border-done/30 bg-done-bg/60 px-6 py-7 text-center animate-fade-up">
          <p className="text-3xl" aria-hidden>
            🎉
          </p>
          <div>
            <p className="text-lg font-semibold">Alles gehaald!</p>
            <p className="text-sm text-muted-foreground">Rond de lijst af, dan begin je de volgende keer met een lege lijst.</p>
          </div>
          <Button onClick={() => void archive()} disabled={archiving}>
            <Archive />
            Lijst afronden
          </Button>
        </Card>
      )}

      {items.length === 0 && (
        <EmptyState
          icon={ShoppingBasket}
          title="De lijst is leeg"
          description="Typ hierboven wat er gehaald moet worden, bijvoorbeeld ‘2 melk’ of ‘1 kg appels’."
        />
      )}

      {groups.map((group) => (
        <section key={group.category} aria-label={SHOPPING_CATEGORY_LABELS[group.category]}>
          <SectionTitle count={group.items.length}>
            <span aria-hidden className="text-base normal-case">
              {SHOPPING_CATEGORY_EMOJI[group.category]}
            </span>
            {SHOPPING_CATEGORY_LABELS[group.category]}
          </SectionTitle>
          <ul className="grid gap-2">
            {group.items.map((item) => (
              <ShoppingItem key={item.id} item={item} onEdit={setEditing} />
            ))}
          </ul>
        </section>
      ))}

      {bought.length > 0 && <Basket items={bought} onEdit={setEditing} />}

      <EditItemDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/** Snel toevoegen: "2 melk", "melk 2x", "1 kg appels" */
function QuickAdd({ onAdd }: { onAdd: (name: string, quantity: string | null, category: ShoppingCategory) => unknown }) {
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const parsed = parseShoppingInput(value);
  const category = parsed.name ? guessCategory(parsed.name) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.name) return;
    void onAdd(parsed.name.slice(0, 80), parsed.quantity?.slice(0, 30) ?? null, category ?? "other");
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={submit} className="grid gap-1.5">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Wat moet er gehaald worden?"
            aria-label="Product toevoegen"
            enterKeyHint="done"
            autoComplete="off"
            className="h-12 rounded-2xl pr-11"
          />
          {category && (
            <span
              className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-lg"
              title={SHOPPING_CATEGORY_LABELS[category]}
              aria-hidden
            >
              {SHOPPING_CATEGORY_EMOJI[category]}
            </span>
          )}
        </div>
        <Button type="submit" size="icon" className="size-12" disabled={!parsed.name} aria-label="Toevoegen">
          <Plus className="size-5" />
        </Button>
      </div>
      {parsed.name && parsed.quantity && (
        <p className="px-1 text-xs text-muted-foreground">
          {parsed.quantity} × {parsed.name}
          {category && ` · ${SHOPPING_CATEGORY_LABELS[category]}`}
        </p>
      )}
    </form>
  );
}

/** Gekochte producten, doorgestreept en in te klappen */
function Basket({ items, onEdit }: { items: ShoppingItemRow[]; onEdit: (item: ShoppingItemRow) => void }) {
  const [expanded, setExpanded] = React.useState<boolean | null>(null);
  const isOpen = expanded ?? items.length < BASKET_COLLAPSE_FROM;

  return (
    <section aria-label="In je mandje">
      <SectionTitle
        count={items.length}
        action={
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={isOpen}
            onClick={() => setExpanded(!isOpen)}
            className="text-muted-foreground"
          >
            {isOpen ? "Verbergen" : "Tonen"}
            <ChevronDown className={cn("transition-transform", isOpen && "rotate-180")} />
          </Button>
        }
      >
        <ShoppingBasket className="size-3.5" />
        In je mandje
      </SectionTitle>
      {isOpen && (
        <ul className="grid gap-1.5">
          {items.map((item) => (
            <ShoppingItem key={item.id} item={item} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </section>
  );
}
