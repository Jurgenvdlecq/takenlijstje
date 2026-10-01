"use client";

import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { useSnapshot } from "@/features/household/store";
import { AccountSection } from "./account-section";
import { AfvalSection } from "./afval-section";
import { HouseholdSection } from "./household-section";
import { MembersSection } from "./members-section";
import { NotificationsSection } from "./notifications-section";
import { ProfileSection } from "./profile-section";
import { RecurrencesSection } from "./recurrences-section";
import { TemplatesSection } from "./templates-section";

const JUMP_LINKS = [
  { href: "#profiel", label: "Profiel" },
  { href: "#meldingen", label: "Meldingen" },
  { href: "#huishouden", label: "Huishouden" },
  { href: "#afvalkalender", label: "Afval" },
  { href: "#gezinsleden", label: "Gezinsleden" },
  { href: "#terugkerend", label: "Terugkerend" },
  { href: "#standaardtaken", label: "Standaardtaken" },
  { href: "#account", label: "Account" },
];

export function SettingsPage() {
  const snapshot = useSnapshot();
  return (
    <div className="pb-6">
      <PageHeader title="Instellingen" subtitle={snapshot.household.name} />

      <nav aria-label="Onderdelen" className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex w-max gap-2">
          {JUMP_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-5">
        {/* Remount bij een ander huishouden/lid zodat formulieren verse beginwaarden krijgen */}
        <React.Fragment key={`${snapshot.household.id}:${snapshot.me.id}`}>
          <ProfileSection />
          <NotificationsSection />
          <HouseholdSection />
          <AfvalSection />
          <MembersSection />
          <RecurrencesSection />
          <TemplatesSection />
          <AccountSection />
        </React.Fragment>
      </div>
    </div>
  );
}
