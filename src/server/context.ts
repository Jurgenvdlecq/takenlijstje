import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, type DbClient } from "@/lib/supabase/server";
import type { HouseholdRow, MemberRow } from "@/types/database";
import { UserError } from "./errors";

export const HOUSEHOLD_COOKIE = "tl_household";

export interface HouseholdContext {
  supabase: DbClient;
  user: User;
  household: HouseholdRow;
  member: MemberRow;
  isAdmin: boolean;
}

type Membership =
  | { kind: "signed-out" }
  | { kind: "none"; supabase: DbClient; user: User }
  | { kind: "inactive"; supabase: DbClient; user: User }
  | { kind: "active"; ctx: HouseholdContext };

/** Ingelogde gebruiker (gevalideerd bij Supabase) of null. */
export const getUser = cache(async (): Promise<{ supabase: DbClient; user: User | null }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

/**
 * Lidmaatschap van de gebruiker. Alleen een ACTIEF lid heeft toegang (V-29);
 * de database dwingt dat ook af (private.is_member). Een uitgezet lid kan zijn
 * eigen rij nog lezen, zodat de app het scherm "geen toegang" kan tonen.
 */
const getMembership = cache(async (): Promise<Membership> => {
  const { supabase, user } = await getUser();
  if (!user) return { kind: "signed-out" };

  const { data: memberships } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", user.id)
    .order("created_at");
  if (!memberships?.length) return { kind: "none", supabase, user };

  const active = memberships.filter((m) => m.is_active && m.households);
  if (!active.length) return { kind: "inactive", supabase, user };

  const preferred = (await cookies()).get(HOUSEHOLD_COOKIE)?.value;
  const row = active.find((m) => m.household_id === preferred) ?? active[0];
  const { households, ...member } = row as unknown as MemberRow & { households: HouseholdRow };
  return { kind: "active", ctx: { supabase, user, household: households, member, isAdmin: member.role === "admin" } };
});

/** Huidig huishouden van een actief lid, of null. */
export const getHouseholdContext = cache(async (): Promise<HouseholdContext | null> => {
  const membership = await getMembership();
  return membership.kind === "active" ? membership.ctx : null;
});

/** Voor pagina's: stuur door naar inloggen, "geen toegang" of onboarding als dat nodig is. */
export async function requirePageContext(): Promise<HouseholdContext> {
  const membership = await getMembership();
  if (membership.kind === "signed-out") redirect("/login");
  if (membership.kind === "inactive") redirect("/geen-toegang");
  if (membership.kind === "none") redirect("/onboarding");
  return membership.ctx;
}

/** Is de ingelogde gebruiker een uitgezet lid? (voor /geen-toegang en /onboarding) */
export async function isInactiveMember(): Promise<boolean> {
  return (await getMembership()).kind === "inactive";
}

/** Ingelogde gebruiker, anders een nette fout (UNAUTHENTICATED). */
export async function requireUser(): Promise<{ supabase: DbClient; user: User }> {
  const { supabase, user } = await getUser();
  if (!user) throw new UserError("Je bent niet (meer) ingelogd. Log opnieuw in.", "UNAUTHENTICATED");
  return { supabase, user };
}

/** Voor server actions: actief lid, anders een nette fout. Huishouden en lid komen altijd uit de sessie. */
export async function requireMember(): Promise<HouseholdContext> {
  const membership = await getMembership();
  switch (membership.kind) {
    case "signed-out":
      throw new UserError("Je bent niet (meer) ingelogd. Log opnieuw in.", "UNAUTHENTICATED");
    case "inactive":
      throw new UserError("Je hebt op dit moment geen toegang tot dit huishouden.", "FORBIDDEN");
    case "none":
      throw new UserError("Je bent geen lid van een huishouden.", "FORBIDDEN");
    case "active":
      return membership.ctx;
  }
}

export async function requireAdmin(): Promise<HouseholdContext> {
  const ctx = await requireMember();
  if (!ctx.isAdmin) throw new UserError("Alleen een beheerder kan dit doen.", "FORBIDDEN");
  return ctx;
}
