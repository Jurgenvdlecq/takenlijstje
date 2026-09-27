import type { Metadata } from "next";
import { ShoppingPage } from "@/features/shopping/shopping-page";

export const metadata: Metadata = { title: "Boodschappen" };

export default function BoodschappenPage() {
  return <ShoppingPage />;
}
