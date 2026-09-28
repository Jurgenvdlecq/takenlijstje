"use client";

import { Loader2, LogOut } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { clearLocalData } from "@/lib/offline/clear";
import { readOutbox } from "@/lib/offline/outbox";

/**
 * Uitloggen: waarschuwt als er nog offline wijzigingen wachten, wist daarna
 * de gegevens op dit toestel (BR-43) en logt uit.
 */
export function SignOutButton({
  variant = "outline",
  className,
  children,
}: {
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
  children?: React.ReactNode;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function signOut() {
    const waiting = (await readOutbox()).length;
    if (
      waiting > 0 &&
      !window.confirm(
        `Er ${waiting === 1 ? "staat nog 1 wijziging" : `staan nog ${waiting} wijzigingen`} op dit toestel die nog niet zijn verstuurd. Als je nu uitlogt, gaan die verloren. Toch uitloggen?`,
      )
    ) {
      return;
    }
    setBusy(true);
    await clearLocalData();
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <Button type="button" variant={variant} className={className} disabled={busy} onClick={() => void signOut()}>
        {busy ? <Loader2 className="animate-spin" /> : <LogOut />}
        {children ?? "Uitloggen"}
      </Button>
      <form ref={formRef} action="/auth/signout" method="post" hidden />
    </>
  );
}
