"use client";

import { CheckIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useHousehold } from "@/features/household/store";
import { cn } from "@/lib/utils";
import type { ShoppingItemRow } from "@/types/database";

/** Eén product op de lijst: tik om af te vinken, menu voor bewerken/verwijderen. */
export function ShoppingItem({ item, onEdit }: { item: ShoppingItemRow; onEdit: (item: ShoppingItemRow) => void }) {
  const { mutate } = useHousehold();
  const [popping, setPopping] = React.useState(false);
  const bought = item.is_bought;

  const toggle = () => {
    if (!bought) setPopping(true);
    void mutate("shoppingToggle", { id: item.id, bought: !bought });
  };

  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-2xl border bg-card pr-1.5 shadow-xs transition animate-fade-up",
        bought && "border-transparent bg-muted/50 shadow-none",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={bought}
        aria-label={bought ? `${item.name}: terug op de lijst` : `${item.name} in je mandje`}
        onClick={toggle}
        className="group/check flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl py-2.5 pl-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
      >
        <span
          onAnimationEnd={() => setPopping(false)}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors",
            bought
              ? "border-done bg-done text-white"
              : "border-muted-foreground/35 group-hover/check:border-done group-hover/check:bg-done-bg",
            popping && "animate-pop",
          )}
        >
          {bought && <CheckIcon className="size-4" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "truncate font-medium transition-colors",
                bought && "text-muted-foreground line-through decoration-2",
              )}
            >
              {item.name}
            </span>
            {item.quantity && (
              <span
                className={cn(
                  "shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground",
                  bought && "opacity-60",
                )}
              >
                {item.quantity}
              </span>
            )}
          </span>
          {item.note && (
            <span className={cn("mt-0.5 block truncate text-xs text-muted-foreground", bought && "line-through")}>
              {item.note}
            </span>
          )}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Opties voor ${item.name}`}>
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(item)}>
            <Pencil />
            Bewerken
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => void mutate("shoppingDelete", { id: item.id })}>
            <Trash2 />
            Verwijderen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
