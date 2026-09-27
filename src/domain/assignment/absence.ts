/** Afwezigheid / vakantie van gezinsleden. */
import { addDays, diffDays, type ISODate } from "../dates";

export type AbsenceStrategy = "reassign" | "postpone" | "unassign";

export interface Absence {
  memberId: string;
  startsOn: ISODate;
  endsOn: ISODate;
  strategy: AbsenceStrategy;
}

export function isAbsentOn(absences: Absence[], memberId: string, date: ISODate): boolean {
  return absences.some((a) => a.memberId === memberId && date >= a.startsOn && date <= a.endsOn);
}

export function absenceOn(absences: Absence[], memberId: string, date: ISODate): Absence | undefined {
  return absences.find((a) => a.memberId === memberId && date >= a.startsOn && date <= a.endsOn);
}

/** Bij "doorschuiven": de eerste dag na de afwezigheid, en hoeveel dagen dat is. */
export function postponeTarget(absence: Absence, date: ISODate): { date: ISODate; shiftDays: number } {
  const target = addDays(absence.endsOn, 1);
  return { date: target, shiftDays: diffDays(date, target) };
}
