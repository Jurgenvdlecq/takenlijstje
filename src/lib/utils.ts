import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Client-side UUID voor idempotente acties (offline opnieuw versturen). */
export function newId(): string {
  return crypto.randomUUID();
}
