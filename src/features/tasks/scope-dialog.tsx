"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** "Alleen deze taak" of "Deze en toekomstige taken" bij een terugkerende taak. */
export function ScopeDialog({
  open,
  onOpenChange,
  title,
  onChoose,
  onlyFuture,
  destructive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onChoose: (scope: "this" | "future") => void;
  /** Wijziging die alleen voor de reeks kan (bijv. herhaling aanpassen) */
  onlyFuture?: boolean;
  destructive?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Dit is een terugkerende taak.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-2 pb-6">
          {!onlyFuture && (
            <Button variant="outline" size="lg" className="justify-start" onClick={() => onChoose("this")}>
              Alleen deze taak
            </Button>
          )}
          <Button
            variant={destructive ? "destructive" : "default"}
            size="lg"
            className="justify-start"
            onClick={() => onChoose("future")}
          >
            Deze en toekomstige taken
          </Button>
          {onlyFuture && (
            <p className="text-xs text-muted-foreground">
              Een andere herhaling of verdeling geldt voor deze en alle volgende keren.
            </p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
