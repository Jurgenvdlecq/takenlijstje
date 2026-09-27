import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { getHouseholdContext, getUser } from "@/server/context";
import type { MemberRow, TemplateRow } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Aan de slag" };

export default async function OnboardingPage() {
  const { supabase: userDb, user } = await getUser();
  if (!user) redirect("/login");

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

  const metaName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
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
