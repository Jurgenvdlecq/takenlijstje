"use client";

import { ArrowLeftRight, UserRoundX, Users } from "lucide-react";
import * as React from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useHousehold } from "@/features/household/store";
import { requestSwapAction } from "@/server/actions/tasks";
import type { TaskRow } from "@/types/database";
import { useTaskActions } from "./use-task-actions";

/** "Ik kan deze taak niet doen": terugzetten, iemand anders kiezen of ruilverzoek sturen. */
export function CannotDoDialog({ task, open, onOpenChange }: { task: TaskRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { snapshot, run } = useHousehold();
  const { assign } = useTaskActions();
  const [step, setStep] = React.useState<"menu" | "pick" | "swap">("menu");
  const [message, setMessage] = React.useState("");
  const canAssignOthers = snapshot.household.members_can_assign_others || snapshot.me.role === "admin";
  const others = snapshot.members.filter((m) => m.is_active && m.id !== task.assigned_member_id);

  function close() {
    onOpenChange(false);
    setStep("menu");
    setMessage("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ik kan deze taak niet doen</DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-2 pb-6">
          {step === "menu" && (
            <>
              <Button variant="outline" size="lg" className="justify-start" onClick={() => setStep("swap")}>
                <ArrowLeftRight /> Ruilverzoek sturen
              </Button>
              {canAssignOthers && (
                <Button variant="outline" size="lg" className="justify-start" onClick={() => setStep("pick")}>
                  <Users /> Iemand anders kiezen
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="justify-start"
                onClick={async () => {
                  await assign(task.id, null);
                  close();
                }}
              >
                <UserRoundX /> Terugzetten naar “nog te verdelen”
              </Button>
            </>
          )}
          {step === "pick" &&
            others.map((m) => (
              <Button
                key={m.id}
                variant="outline"
                size="lg"
                className="justify-start"
                onClick={async () => {
                  await assign(task.id, m.id);
                  close();
                }}
              >
                <MemberAvatar member={m} size="xs" /> {m.display_name}
              </Button>
            ))}
          {step === "swap" && (
            <form
              className="grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await run(() => requestSwapAction(task.id, message || null), {
                  success: "Ruilverzoek verstuurd naar je huisgenoten",
                });
                if (ok !== null) close();
              }}
            >
              <Input
                value={message}
                maxLength={300}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optioneel: bijv. ik ben zaterdag weg"
                aria-label="Bericht bij ruilverzoek"
              />
              <Button type="submit" size="lg">
                Verstuur ruilverzoek
              </Button>
            </form>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
