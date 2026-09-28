"use client";

import { Lock } from "lucide-react";
import * as React from "react";
import { clearLocalData } from "@/lib/offline/clear";
import { SignOutButton } from "./sign-out-button";

export function NoAccess({ householdName }: { householdName: string | null }) {
  // Gegevens van het huishouden horen niet meer op dit toestel (BR-43)
  React.useEffect(() => {
    void clearLocalData();
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="rounded-full bg-accent p-4 text-accent-foreground">
        <Lock className="size-7" />
      </div>
      <h1 className="text-xl font-semibold">Geen toegang</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Je hebt op dit moment geen toegang tot {householdName ? `‘${householdName}’` : "dit huishouden"}. Een beheerder kan
        je weer toegang geven.
      </p>
      <SignOutButton className="mt-2" />
    </main>
  );
}
