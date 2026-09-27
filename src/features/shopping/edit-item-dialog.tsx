"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useHousehold } from "@/features/household/store";
import { SHOPPING_CATEGORY_EMOJI, SHOPPING_CATEGORY_LABELS } from "@/lib/labels";
import { updateShoppingItemAction } from "@/server/actions/shopping";
import type { ShoppingCategory, ShoppingItemRow } from "@/types/database";
import { SHOPPING_CATEGORY_ORDER } from "./parse";

/** Venster om een product te bewerken (naam, hoeveelheid, categorie, notitie). */
export function EditItemDialog({ item, onClose }: { item: ShoppingItemRow | null; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Product bewerken</DialogTitle>
          <DialogDescription>Pas aan wat er gehaald moet worden.</DialogDescription>
        </DialogHeader>
        {item && <EditItemForm key={item.id} item={item} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditItemForm({ item, onDone }: { item: ShoppingItemRow; onDone: () => void }) {
  const { run } = useHousehold();
  const [name, setName] = React.useState(item.name);
  const [quantity, setQuantity] = React.useState(item.quantity ?? "");
  const [category, setCategory] = React.useState<ShoppingCategory>(item.category);
  const [note, setNote] = React.useState(item.note ?? "");
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    // De actie geeft bij succes `null` terug; omzetten naar `true` om succes te herkennen
    const ok = await run(
      async () => {
        const result = await updateShoppingItemAction(item.id, {
          name: name.trim(),
          quantity: quantity.trim() || null,
          category,
          note: note.trim() || null,
        });
        return result.ok ? { ok: true as const, data: true } : result;
      },
      { success: "Opgeslagen" },
    );
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <form onSubmit={submit} className="contents">
      <DialogBody className="grid gap-4">
        <Field label="Product" htmlFor="shopping-name">
          <Input id="shopping-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hoeveelheid" htmlFor="shopping-quantity">
            <Input
              id="shopping-quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              maxLength={30}
              placeholder="bijv. 2 pakken"
              autoComplete="off"
            />
          </Field>
          <Field label="Categorie" htmlFor="shopping-category">
            <NativeSelect id="shopping-category" value={category} onChange={(e) => setCategory(e.target.value as ShoppingCategory)}>
              {SHOPPING_CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {SHOPPING_CATEGORY_EMOJI[c]} {SHOPPING_CATEGORY_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Notitie" htmlFor="shopping-note" hint="Bijvoorbeeld een merk of ‘in de aanbieding’.">
          <Textarea id="shopping-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={2} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Annuleren
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Opslaan…" : "Opslaan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
