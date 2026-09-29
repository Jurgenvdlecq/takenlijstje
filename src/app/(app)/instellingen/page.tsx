import type { Metadata } from "next";
import { SettingsPage } from "@/features/settings/settings-page";

export const metadata: Metadata = { title: "Instellingen" };

// Afvalkalender: opzoeken en bevestigen kan tot 12 s bij de gemeente duren (TD §18.6)
export const maxDuration = 30;

export default function InstellingenPage() {
  return <SettingsPage />;
}
