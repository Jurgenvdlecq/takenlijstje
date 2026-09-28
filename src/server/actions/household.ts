"use server";

import { z } from "zod";
import { todayIn } from "@/domain/dates";
import { publicEnv } from "@/lib/env";
import { hexColor, householdSettingsInput, memberInput, templateActivationInput, uuid } from "@/lib/validation";
import type { HouseholdRow, MemberRow, TemplateRow } from "@/types/database";
import { getUser, requireAdmin, requireMember } from "../context";
import { check, expectRows, runAction, UserError, type ActionResult } from "../errors";
import { parse } from "../parse";
import { topUp } from "../system/planner";

const MEMBER_COLORS = ["#2563eb", "#db2777", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2", "#dc2626", "#65a30d"];

// ---------------------------------------------------------------------------
// Huishouden
// ---------------------------------------------------------------------------
export async function createHouseholdAction(raw: {
  name: string;
  displayName: string;
  color?: string;
}): Promise<ActionResult<string>> {
  return runAction("createHousehold", async () => {
    const { supabase, user } = await getUser();
    if (!user) throw new UserError("Log eerst in.");
    const input = parse(
      z.object({
        name: z.string().trim().min(1, "Geef je huishouden een naam").max(80),
        displayName: z.string().trim().min(1, "Vul je naam in").max(50),
        color: hexColor.default(MEMBER_COLORS[0]),
      }),
      raw,
    );
    // De database weigert als je al bij een huishouden hoort (BR-44) en zet de
    // tijdzone altijd op Europe/Amsterdam (V-39)
    return check(
      await supabase.rpc("create_household", {
        p_name: input.name,
        p_display_name: input.displayName,
        p_color: input.color,
      }),
    ) as string;
  });
}

export async function updateHouseholdAction(raw: z.input<typeof householdSettingsInput>): Promise<ActionResult<HouseholdRow>> {
  return runAction("updateHousehold", async () => {
    const { supabase, household } = await requireAdmin();
    const input = parse(householdSettingsInput, raw);
    const [updated] = expectRows(
      await supabase
        .from("households")
        .update({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.membersCanCreateTasks !== undefined && { members_can_create_tasks: input.membersCanCreateTasks }),
        })
        .eq("id", household.id)
        .select("*"),
    ) as HouseholdRow[];
    return updated;
  });
}

export async function completeOnboardingAction(): Promise<ActionResult<true>> {
  return runAction("completeOnboarding", async () => {
    const { supabase, household } = await requireAdmin();
    expectRows(await supabase.from("households").update({ onboarding_completed: true }).eq("id", household.id).select("id"));
    return true as const;
  });
}

// ---------------------------------------------------------------------------
// Gezinsleden
// ---------------------------------------------------------------------------
export async function updateMemberAction(memberId: string, raw: Partial<z.input<typeof memberInput>>): Promise<ActionResult<MemberRow>> {
  return runAction("updateMember", async () => {
    const { supabase, household, member, isAdmin } = await requireMember();
    const id = parse(uuid, memberId);
    if (!isAdmin && id !== member.id) throw new UserError("Je kunt alleen je eigen profiel aanpassen.");
    const input = parse(memberInput.partial(), raw);
    const [updated] = expectRows(
      await supabase
        .from("household_members")
        .update({
          ...(input.displayName !== undefined && { display_name: input.displayName }),
          ...(input.color !== undefined && { color: input.color }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(isAdmin && input.role !== undefined && { role: input.role }),
          ...(isAdmin && input.isActive !== undefined && { is_active: input.isActive }),
        })
        .eq("id", id)
        .eq("household_id", household.id)
        .select("*"),
      "Dit gezinslid bestaat niet (meer).",
      "NOT_FOUND",
    ) as MemberRow[];
    return updated;
  });
}

export async function removeMemberAction(memberId: string): Promise<ActionResult<true>> {
  return runAction("removeMember", async () => {
    const { supabase, household, member } = await requireAdmin();
    const id = parse(uuid, memberId);
    if (id === member.id) throw new UserError("Je kunt jezelf niet verwijderen.");
    expectRows(
      await supabase.from("household_members").delete().eq("id", id).eq("household_id", household.id).select("id"),
      "Dit gezinslid bestaat niet (meer).",
      "NOT_FOUND",
    );
    return true as const;
  });
}

// ---------------------------------------------------------------------------
// Uitnodigingen
// ---------------------------------------------------------------------------
export async function createInvitationAction(raw: {
  id: string;
  email?: string | null;
  role?: "admin" | "member";
}): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  return runAction("createInvitation", async () => {
    const { supabase, household, member } = await requireAdmin();
    const input = parse(
      z.object({
        /** Door de client gegenereerd: dubbel tikken geeft één uitnodiging (R-03) */
        id: uuid,
        email: z.email("Ongeldig e-mailadres").nullable().optional().or(z.literal("").transform(() => null)),
        role: z.enum(["admin", "member"]).default("member"),
      }),
      raw,
    );
    const id = input.id;
    check(
      await supabase.from("household_invitations").upsert(
        {
          id,
          household_id: household.id,
          email: input.email ?? null,
          role: input.role,
          invited_by_member_id: member.id,
        },
        { onConflict: "id", ignoreDuplicates: true },
      ),
    );
    const invitation = check(
      await supabase
        .from("household_invitations")
        .select("token, expires_at")
        .eq("id", id)
        .eq("household_id", household.id)
        .single(),
    );
    return { url: `${publicEnv.siteUrl}/invite/${invitation.token}`, expiresAt: invitation.expires_at };
  });
}

export async function acceptInvitationAction(token: string, displayName?: string): Promise<ActionResult<string>> {
  return runAction("acceptInvitation", async () => {
    const { supabase, user } = await getUser();
    if (!user) throw new UserError("Log eerst in om de uitnodiging te accepteren.");
    const t = parse(z.string().regex(/^[a-f0-9]{64}$/, "Ongeldige uitnodiging"), token);
    const name = parse(z.string().trim().max(50).optional(), displayName);
    return check(await supabase.rpc("accept_invitation", { p_token: t, p_display_name: name || null })) as string;
  });
}

// ---------------------------------------------------------------------------
// Standaardtaken activeren (onboarding + instellingen)
// ---------------------------------------------------------------------------
export async function activateTemplatesAction(raw: z.input<typeof templateActivationInput>): Promise<ActionResult<number>> {
  return runAction("activateTemplates", async () => {
    const { supabase, household, member } = await requireMember();
    const input = parse(templateActivationInput, raw);
    const today = todayIn(household.timezone);

    const templates = check(
      await supabase.from("task_templates").select("*").in("id", input.items.map((i) => i.templateId)),
    ) as TemplateRow[];

    const rows = input.items.map((item) => {
      const template = templates.find((t) => t.id === item.templateId);
      if (!template) throw new UserError("Onbekende standaardtaak.");
      return {
        id: item.recurrenceId,
        household_id: household.id,
        template_id: template.id,
        title: item.title ?? template.title,
        description: template.description,
        category: template.category,
        duration_minutes: template.duration_minutes,
        rule: item.rule,
        time_of_day: item.timeOfDay ?? template.default_time,
        starts_on: today,
        created_by_member_id: member.id,
      };
    });

    // Met de gebruikersclient (RLS can_create_tasks); dubbel activeren met
    // dezelfde id's geeft geen extra reeksen (R-03)
    check(await supabase.from("task_recurrences").upsert(rows, { onConflict: "id", ignoreDuplicates: true }));
    // Inplannen voor de reeksen die nu in het EIGEN huishouden bestaan (teruggelezen
    // met de gebruikersclient, TD §5.3). Een herhaald verzoek vult zo ook een eerder
    // mislukte planning aan; een id van een ander huishouden plant niets.
    const own = check(
      await supabase.from("task_recurrences").select("id").eq("household_id", household.id).in("id", rows.map((r) => r.id)),
    ) as { id: string }[];
    if (own.length) await topUp(household.id, own.map((r) => r.id));
    return rows.length;
  });
}
