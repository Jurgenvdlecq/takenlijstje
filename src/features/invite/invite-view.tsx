"use client";

import { Loader2, MailOpen, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { acceptInvitationAction } from "@/server/actions/household";

interface InvitationInfo {
  household_name: string;
  invited_by: string | null;
  email: string | null;
  expires_at: string;
}

export function InviteView({
  token,
  invitation,
  loggedIn,
  userEmail,
  suggestedName,
}: {
  token: string;
  invitation: InvitationInfo | null;
  loggedIn: boolean;
  userEmail: string | null;
  suggestedName: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = React.useState(suggestedName);
  const [busy, setBusy] = React.useState(false);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await acceptInvitationAction(token, displayName);
      if (!result.ok) {
        toast.error(result.error);
        setBusy(false);
        return;
      }
      toast.success(`Welkom bij ${invitation?.household_name ?? "het huishouden"}!`);
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Er ging iets mis. Controleer je verbinding en probeer het opnieuw.");
      setBusy(false);
    }
  }

  const next = encodeURIComponent(`/invite/${token}`);

  return (
    <main className="safe-top mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-center gap-2 font-semibold">
        <span aria-hidden className="text-xl">
          🏡
        </span>
        Takenlijstje
      </div>

      <Card className="p-6 text-center animate-fade-up">
        {!invitation ? (
          <div className="grid justify-items-center gap-3">
            <div className="rounded-full bg-overdue-bg p-4 text-overdue">
              <TriangleAlert className="size-7" />
            </div>
            <h1 className="text-xl font-bold">Deze uitnodiging is ongeldig of verlopen</h1>
            <p className="text-sm text-muted-foreground">
              Vraag degene die je uitnodigde om een nieuwe link te sturen. Die kan dat doen via Instellingen › Gezinsleden.
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link href="/">Naar de app</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="grid justify-items-center gap-3">
              <div className="rounded-full bg-accent p-4 text-accent-foreground">
                <MailOpen className="size-7" />
              </div>
              <h1 className="text-xl font-bold text-balance">
                {invitation.invited_by ? `${invitation.invited_by} nodigt je uit` : "Je bent uitgenodigd"} voor{" "}
                <span className="text-primary">{invitation.household_name}</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Samen de huishoudelijke taken plannen, verdelen en afvinken.
              </p>
            </div>

            {!loggedIn ? (
              <div className="grid gap-2">
                <Button asChild size="lg">
                  <Link href={`/login?next=${next}&mode=register`}>Account aanmaken</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href={`/login?next=${next}`}>Ik heb al een account – inloggen</Link>
                </Button>
                {invitation.email && (
                  <p className="text-xs text-muted-foreground">Deze uitnodiging is verstuurd naar {invitation.email}.</p>
                )}
              </div>
            ) : (
              <form onSubmit={accept} className="grid gap-4 text-left">
                <Field label="Hoe wil je heten in dit huishouden?" htmlFor="uitn-naam">
                  <Input
                    id="uitn-naam"
                    value={displayName}
                    maxLength={50}
                    placeholder="Je voornaam"
                    className="h-12 text-base"
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </Field>
                <Button type="submit" size="lg" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />}
                  {busy ? "Bezig…" : "Uitnodiging accepteren"}
                </Button>
                {userEmail && (
                  <p className="text-center text-xs text-muted-foreground">
                    Je bent ingelogd als {userEmail}. Niet jij?{" "}
                    <button form="uitloggen" type="submit" className="font-medium text-primary underline-offset-4 hover:underline">
                      Uitloggen
                    </button>
                  </p>
                )}
              </form>
            )}
          </div>
        )}
      </Card>
      {/* Los formulier: formulieren mogen niet genest worden */}
      <form id="uitloggen" action="/auth/signout" method="post" hidden />
    </main>
  );
}
