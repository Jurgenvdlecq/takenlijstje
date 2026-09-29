import { redirect } from "next/navigation";

/**
 * Oude UI (WP3b): de storingsmelding opent deze route; de sectie
 * Afvalkalender brengt zichzelf in beeld bij #afvalkalender (§18.9.3, AC-223).
 * In WP7 wordt dit de echte subpagina.
 */
export default function AfvalkalenderPage() {
  redirect("/instellingen#afvalkalender");
}
