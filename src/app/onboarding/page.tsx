import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { getHouseholdContext, getUser, isInactiveMember } from "@/server/context";
import type { MemberRow, TemplateRow } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Aan de slag" };

export default async function OnboardingPage() {
  const { supabase: userDb, user } = await getUser();
  if (!user) redirect("/login");

  // Een uitgezet lid maakt geen nieuw huishouden aan, maar ziet waarom hij geen toegang heeft
  if (await isInactiveMember()) redirect("/geen-toegang");

  const ctx = await getHouseholdContext();
  if (ctx?.household.onboarding_completed) redirect("/");
  // Alleen een beheerder richt het huishouden in; gezinsleden kunnen gewoon verder
  if (ctx && !ctx.isAdmin) redirect("/");

  const supabase = ctx?.supabase ?? userDb;
  const [templatesResult, membersResult] = await Promise.all([
    supabase.from("task_templates").select("*").is("household_id", null).order("sort_order"),
    ctx
      ? supabase.from("household_members").select("*").eq("household_id", ctx.household.id).order("sort_order").order("created_at")
      : Promise.resolve({ data: [] as MemberRow[], error: null }),
  ]);

  // Naam uit de registratie (display_name) of van Google/Apple (full_name)
  const meta = user.user_metadata ?? {};
  const metaName =
    typeof meta.display_name === "string" ? meta.display_name : typeof meta.full_name === "string" ? meta.full_name : null;
  const suggestedName = metaName ?? (user.email ? user.email.split("@")[0] : "");

  return (
    <OnboardingWizard
      household={ctx ? { id: ctx.household.id, name: ctx.household.name, timezone: ctx.household.timezone } : null}
      meId={ctx?.member.id ?? null}
      members={(membersResult.data ?? []) as MemberRow[]}
      templates={(templatesResult.data ?? []) as TemplateRow[]}
      suggestedName={suggestedName}
    />
  );
}
