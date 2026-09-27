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

/** Ingelogde gebruiker (gevalideerd bij Supabase) of null. */
export const getUser = cache(async (): Promise<{ supabase: DbClient; user: User | null }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

/**
 * Huidige huishouden van de gebruiker. Bij meerdere huishoudens bepaalt een
 * cookie welke actief is; het lidmaatschap wordt altijd opnieuw gecontroleerd.
 */
export const getHouseholdContext = cache(async (): Promise<HouseholdContext | null> => {
  const { supabase, user } = await getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", user.id)
    .order("created_at");
  if (!memberships?.length) return null;

  const preferred = (await cookies()).get(HOUSEHOLD_COOKIE)?.value;
  const row = memberships.find((m) => m.household_id === preferred) ?? memberships[0];
  const { households, ...member } = row as unknown as MemberRow & { households: HouseholdRow };

  return { supabase, user, household: households, member, isAdmin: member.role === "admin" };
});

/** Voor pagina's: stuur door naar inloggen of onboarding als dat nodig is. */
export async function requirePageContext(): Promise<HouseholdContext> {
  const { user } = await getUser();
  if (!user) redirect("/login");
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

/** Voor server actions: gooi een nette fout als er geen toegang is. */
export async function requireMember(): Promise<HouseholdContext> {
  const ctx = await getHouseholdContext();
  if (!ctx) throw new UserError("Je bent niet (meer) ingelogd of geen lid van een huishouden.");
  return ctx;
}

export async function requireAdmin(): Promise<HouseholdContext> {
  const ctx = await requireMember();
  if (!ctx.isAdmin) throw new UserError("Alleen een beheerder kan dit doen.");
  return ctx;
}
