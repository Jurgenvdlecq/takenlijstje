/**
 * Tijdsaanduidingen voor meldingen ("zojuist", "5 min geleden",
 * "gisteren 18:04") en groeperen in "Vandaag" / "Eerder".
 */
import { diffDays, todayIn, zonedDate, zonedTime } from "@/domain/dates";

function clock(instant: string, timeZone: string): string {
  const { hour, minute } = zonedTime(instant, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Relatieve tijd in het Nederlands, in de tijdzone van het huishouden. */
export function relativeTime(instant: string, now: Date, timeZone: string): string {
  const minutes = Math.floor((now.getTime() - new Date(instant).getTime()) / 60_000);
  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;

  const days = diffDays(zonedDate(instant, timeZone), todayIn(timeZone, now));
  if (days <= 0) {
    const hours = Math.floor(minutes / 60);
    return `${hours} uur geleden`;
  }
  if (days === 1) return `gisteren ${clock(instant, timeZone)}`;
  if (days < 7) {
    const weekday = new Intl.DateTimeFormat("nl-NL", { weekday: "long", timeZone }).format(new Date(instant));
    return `${weekday} ${clock(instant, timeZone)}`;
  }
  const sameYear = zonedDate(instant, timeZone).slice(0, 4) === todayIn(timeZone, now).slice(0, 4);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone,
  }).format(new Date(instant));
}

/** Splitst (nieuwste eerst gesorteerde) meldingen in vandaag en eerder. */
export function groupByDay<T extends { created_at: string }>(
  items: T[],
  now: Date,
  timeZone: string,
): { today: T[]; earlier: T[] } {
  const today = todayIn(timeZone, now);
  const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    today: sorted.filter((n) => zonedDate(n.created_at, timeZone) === today),
    earlier: sorted.filter((n) => zonedDate(n.created_at, timeZone) !== today),
  };
}
