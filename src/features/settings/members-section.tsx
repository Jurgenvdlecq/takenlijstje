"use client";

import { MoreVertical, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import * as React from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHousehold } from "@/features/household/store";
import { removeMemberAction } from "@/server/actions/household";
import type { MemberRow } from "@/types/database";
import { InviteForm } from "./invite-form";
import { MemberForm } from "./member-form";
import { SettingsSection } from "./shared";

type DialogState = { kind: "edit"; member: MemberRow } | { kind: "invite" } | null;

export function MembersSection() {
  const { snapshot, run } = useHousehold();
  const isAdmin = snapshot.me.role === "admin";
  const [dialog, setDialog] = React.useState<DialogState>(null);

  const members = [...snapshot.members].sort((a, b) => Number(b.is_active) - Number(a.is_active));

  async function remove(member: MemberRow) {
    if (
      !window.confirm(
        `${member.display_name} verwijderen uit het huishouden? Diegene kan daarna niet meer inloggen bij ${snapshot.household.name}.`,
      )
    )
      return;
    await run(() => removeMemberAction(member.id), { success: `${member.display_name} is verwijderd` });
  }

  return (
    <SettingsSection
      id="gezinsleden"
      icon={Users}
      title="Gezinsleden"
      description={isAdmin ? "Wie doet er mee? Nodig iedereen uit om zelf in te loggen." : "Iedereen in jullie huishouden."}
    >
      <ul className="grid gap-2">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 rounded-2xl border p-3" data-inactive={!member.is_active || undefined}>
            <MemberAvatar member={member} size="md" className={member.is_active ? undefined : "opacity-40 grayscale"} />
            <div className="grid min-w-0 flex-1 gap-1">
              <span className={member.is_active ? "truncate font-medium" : "truncate font-medium text-muted-foreground"}>
                {member.display_name}
                {member.id === snapshot.me.id && <span className="font-normal text-muted-foreground"> (jij)</span>}
              </span>
              <div className="flex flex-wrap gap-1">
                <Badge variant={member.role === "admin" ? "primary" : "default"}>{member.role === "admin" ? "Beheerder" : "Gezinslid"}</Badge>
                {!member.is_active && <Badge variant="outline">niet actief</Badge>}
              </div>
            </div>
            {isAdmin && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Opties voor ${member.display_name}`}>
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setDialog({ kind: "edit", member })}>
                      <Pencil />
                      Bewerken
                    </DropdownMenuItem>
                    {member.id !== snapshot.me.id && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => void remove(member)}>
                          <Trash2 />
                          Verwijderen
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDialog({ kind: "invite" })}>
            <UserPlus />
            Iemand uitnodigen
          </Button>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          {dialog?.kind === "edit" && <MemberForm member={dialog.member} onDone={() => setDialog(null)} />}
          {dialog?.kind === "invite" && <InviteForm />}
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
