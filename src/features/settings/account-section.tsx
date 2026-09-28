"use client";

import { ShieldCheck } from "lucide-react";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { useSnapshot } from "@/features/household/store";
import { SettingsSection } from "./shared";

export function AccountSection() {
  const { me } = useSnapshot();
  return (
    <SettingsSection id="account" icon={ShieldCheck} title="Account">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <span className="text-sm font-medium">Ingelogd als {me.display_name}</span>
          {me.email && <span className="text-xs text-muted-foreground">{me.email}</span>}
        </div>
        <SignOutButton />
      </div>
    </SettingsSection>
  );
}
