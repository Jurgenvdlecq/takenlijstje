/** Nederlandse labels en iconen voor enums. */
import {
  Briefcase,
  CookingPot,
  Leaf,
  Package,
  PawPrint,
  Shirt,
  ShoppingCart,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { AssignmentStrategy, ShoppingCategory, TaskCategory } from "@/types/database";

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  cleaning: "Schoonmaak",
  laundry: "Was",
  groceries: "Boodschappen",
  kitchen: "Keuken",
  outdoor: "Buiten",
  pets: "Huisdieren",
  admin: "Administratie",
  other: "Overig",
};

export const CATEGORY_ICONS: Record<TaskCategory, LucideIcon> = {
  cleaning: Sparkles,
  laundry: Shirt,
  groceries: ShoppingCart,
  kitchen: CookingPot,
  outdoor: Leaf,
  pets: PawPrint,
  admin: Briefcase,
  other: Package,
};

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  produce: "Groente & fruit",
  meat: "Vlees & vis",
  dairy: "Zuivel",
  bread: "Brood",
  drinks: "Dranken",
  frozen: "Diepvries",
  drugstore: "Drogisterij",
  household: "Huishoudelijk",
  other: "Overig",
};

export const SHOPPING_CATEGORY_EMOJI: Record<ShoppingCategory, string> = {
  produce: "🥦",
  meat: "🥩",
  dairy: "🧀",
  bread: "🥖",
  drinks: "🥤",
  frozen: "🧊",
  drugstore: "🧴",
  household: "🧻",
  other: "🛒",
};

export const STRATEGY_LABELS: Record<AssignmentStrategy, { label: string; description: string }> = {
  none: { label: "Niemand vast", description: "Wie tijd heeft pakt de taak op" },
  fixed: { label: "Vaste persoon", description: "Altijd dezelfde persoon" },
  rotation: { label: "Om en om", description: "Iedereen om de beurt" },
  random: { label: "Willekeurig", description: "De app kiest iemand" },
  fair: { label: "Eerlijk verdelen", description: "Wie het minst deed, is aan de beurt" },
};

export const ABSENCE_STRATEGY_LABELS = {
  reassign: "Opnieuw verdelen",
  postpone: "Doorschuiven tot ik terug ben",
  unassign: "Op 'niet toegewezen' zetten",
} as const;

/** Kleuren om uit te kiezen voor gezinsleden */
export const MEMBER_COLORS = ["#2563eb", "#db2777", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2", "#dc2626", "#65a30d"];
