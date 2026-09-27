import type { Metadata } from "next";
import { SettingsPage } from "@/features/settings/settings-page";

export const metadata: Metadata = { title: "Instellingen" };

export default function InstellingenPage() {
  return <SettingsPage />;
}
