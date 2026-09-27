/**
 * Automatische taakverdeling.
 *
 *  - fixed:    altijd dezelfde persoon (bijv. Boodschappen → Jurgen)
 *  - rotation: om en om (WC → Jurgen → Ellen → Lynn → Jurgen …)
 *  - random:   willekeurig iemand die beschikbaar is
 *  - fair:     wie de laagste taakbelasting heeft, krijgt de taak
 *
 * Afwezige of inactieve gezinsleden worden overgeslagen.
 */
import type { ISODate } from "../dates";
import { isAbsentOn, type Absence } from "./absence";

export type AssignmentStrategy = "none" | "fixed" | "rotation" | "random" | "fair";

export interface AssignableMember {
  id: string;
  isActive: boolean;
  sortOrder?: number;
}

/** Belasting per gezinslid in punten (en aantal taken als tiebreaker). */
export type LoadMap = Map<string, { points: number; count: number }>;

export interface AssignmentContext {
  members: AssignableMember[];
  absences: Absence[];
  loads: LoadMap;
  /** Injecteerbaar voor tests */
  random?: () => number;
}

export interface AssignmentInput {
  strategy: AssignmentStrategy;
  date: ISODate;
  fixedMemberId?: string | null;
  rotationMemberIds?: string[];
  /** Volgnummer van de uitvoering binnen de reeks (voor om-en-om) */
  occurrenceIndex?: number;
}

export interface AssignmentResult {
  memberId: string | null;
  reason: "fixed" | "rotation" | "random" | "fair" | "absence" | null;
}

export function availableMembers(ctx: AssignmentContext, date: ISODate): AssignableMember[] {
  return ctx.members
    .filter((m) => m.isActive && !isAbsentOn(ctx.absences, m.id, date))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Gezinslid met de laagste belasting (punten, dan aantal, dan volgorde). */
export function pickFair(candidates: AssignableMember[], loads: LoadMap): AssignableMember | null {
  let best: AssignableMember | null = null;
  let bestLoad = { points: Infinity, count: Infinity };
  for (const member of candidates) {
    const load = loads.get(member.id) ?? { points: 0, count: 0 };
    if (load.points < bestLoad.points || (load.points === bestLoad.points && load.count < bestLoad.count)) {
      best = member;
      bestLoad = load;
    }
  }
  return best;
}

export function pickAssignee(input: AssignmentInput, ctx: AssignmentContext): AssignmentResult {
  const available = availableMembers(ctx, input.date);
  const isAvailable = (id: string | null | undefined) => !!id && available.some((m) => m.id === id);

  switch (input.strategy) {
    case "none":
      return { memberId: null, reason: null };

    case "fixed": {
      if (isAvailable(input.fixedMemberId)) return { memberId: input.fixedMemberId!, reason: "fixed" };
      // Vaste persoon afwezig → eerlijk verdelen onder de rest
      const fallback = pickFair(available, ctx.loads);
      return { memberId: fallback?.id ?? null, reason: fallback ? "absence" : null };
    }

    case "rotation": {
      const order = (input.rotationMemberIds?.length ? input.rotationMemberIds : available.map((m) => m.id)).filter(
        (id) => ctx.members.some((m) => m.id === id && m.isActive),
      );
      if (order.length === 0) return { memberId: null, reason: null };
      const start = (input.occurrenceIndex ?? 0) % order.length;
      // Wie aan de beurt is maar afwezig is, wordt overgeslagen
      for (let i = 0; i < order.length; i++) {
        const id = order[(start + i) % order.length];
        if (isAvailable(id)) return { memberId: id, reason: i === 0 ? "rotation" : "absence" };
      }
      return { memberId: null, reason: null };
    }

    case "random": {
      if (available.length === 0) return { memberId: null, reason: null };
      const rnd = ctx.random ?? Math.random;
      return { memberId: available[Math.floor(rnd() * available.length)].id, reason: "random" };
    }

    case "fair": {
      const member = pickFair(available, ctx.loads);
      return { memberId: member?.id ?? null, reason: member ? "fair" : null };
    }
  }
}

/** Voeg de punten van een (geplande) taak toe aan de belasting. */
export function addLoad(loads: LoadMap, memberId: string | null, points: number): void {
  if (!memberId) return;
  const current = loads.get(memberId) ?? { points: 0, count: 0 };
  loads.set(memberId, { points: current.points + points, count: current.count + 1 });
}
