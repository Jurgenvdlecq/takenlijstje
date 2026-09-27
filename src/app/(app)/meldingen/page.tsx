import type { Metadata } from "next";
import { NotificationsPage } from "@/features/notifications/notifications-page";

export const metadata: Metadata = { title: "Meldingen" };

export default function MeldingenPage() {
  return <NotificationsPage />;
}
