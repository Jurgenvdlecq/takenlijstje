"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { todayIn } from "@/domain/dates";
import { appCookieOptions } from "@/lib/cookies";
import { publicEnv } from "@/lib/env";
import {
  absenceInput,
  hexColor,
  householdSettingsInput,
  memberInput,
  templateActivationInput,
  uuid,
} from "@/lib/validation";
import type { AbsenceRow, HouseholdRow, MemberRow, TemplateRow } from "@/types/database";
import { getUser, HOUSEHOLD_COOKIE, requireAdmin, requireMember } from "../context";
import { check, runAction, UserError, type ActionResult } from "../errors";
import { parse } from "../parse";
import { applyAbsence, topUpSeries } from "../services/scheduling";
import { notifyAssigned, systemDb } from "../services/tasks";

const MEMBER_COLORS = ["#2563eb", "#db2777", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2", "#dc2626", "#65a30d"];

// ---------------------------------------------------------------------------
// Huishouden
// ---------------------------------------------------------------------------
export async function createHouseholdAction(raw: {
  name: string;
  displayName: string;
  color?: string;
  timezone?: string;
}): Promise<ActionResult<string>> {
  return runAction("createHousehold", async () => {
    const { supabase, user } = await getUser();
    if (!user) throw new UserError("Log eerst in.");
    const input = parse(
      z.object({
        name: z.string().trim().min(1, "Geef je huishouden een naam").max(80),
        displayName: z.string().trim().min(1, "Vul je naam in").max(50),
        color: hexColor.default(MEMBER_COLORS[0]),
        timezone: z.string().min(1).max(64).default("Europe/Amsterdam"),
      }),
      raw,
    );
    const householdId = check(
      await supabase.rpc("create_household", {
        p_name: input.name,
        p_display_name: input.displayName,
        p_color: input.color,
        p_timezone: input.timezone,
      }),
    ) as string;
    (await cookies()).set(HOUSEHOLD_COOKIE, householdId, appCookieOptions);
    return householdId;
  });
}

export async function switchHouseholdAction(householdId: string): Promise<ActionResult<null>> {
  return runAction("switchHousehold", async () => {
    const { supabase, user } = await getUser();
    if (!user) throw new UserError("Log eerst in.");
    const id = parse(uuid, householdId);
    const { data } = await supabase.from("household_members").select("id").eq("household_id", id).eq("user_id", user.id).maybeSingle();
    if (!data) throw new UserError("Je bent geen lid van dit huishouden.");
    (await cookies()).set(HOUSEHOLD_COOKIE, id, appCookieOptions);
    return null;
  });
}

export async function updateHouseholdAction(raw: z.input<typeof householdSettingsInput>): Promise<ActionResult<HouseholdRow>> {
  return runAction("updateHousehold", async () => {
    const { supabase, household } = await requireAdmin();
    const input = parse(householdSettingsInput, raw);
    if (input.timezone) {
      try {
        new Intl.DateTimeFormat("nl-NL", { timeZone: input.timezone });
      } catch {
        throw new UserError("Onbekende tijdzone.");
      }
    }
    return check(
      await supabase
        .from("households")
        .update({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
          ...(input.membersCanCreateTasks !== undefined && { members_can_create_tasks: input.membersCanCreateTasks }),
          ...(input.membersCanAssignOthers !== undefined && { members_can_assign_others: input.membersCanAssignOthers }),
          ...(input.pointsEnabled !== undefined && { points_enabled: input.pointsEnabled }),
          ...(input.pointsGoal !== undefined && { points_goal: input.pointsGoal }),
          ...(input.pointsGoalReward !== undefined && { points_goal_reward: input.pointsGoalReward }),
        })
        .eq("id", household.id)
        .select("*")
        .single(),
    ) as HouseholdRow;
  });
}

export async function completeOnboardingAction(): Promise<ActionResult<null>> {
  return runAction("completeOnboarding", async () => {
    const { supabase, household } = await requireAdmin();
    check(await supabase.from("households").update({ onboarding_completed: true }).eq("id", household.id));
    return null;
  });
}

// ---------------------------------------------------------------------------
// Gezinsleden
// ---------------------------------------------------------------------------
export async function addMemberAction(raw: z.input<typeof memberInput>): Promise<ActionResult<MemberRow>> {
  return runAction("addMember", async () => {
    const { supabase, household } = await requireAdmin();
    const input = parse(memberInput, raw);
    const { count } = await supabase
      .from("household_members")
      .select("id", { count: "exact", head: true })
      .eq("household_id", household.id);
    return check(
      await supabase
        .from("household_members")
        .insert({
          household_id: household.id,
          display_name: input.displayName,
          color: input.color,
          icon: input.icon ?? null,
          role: input.role,
          email: input.email ?? null,
          is_active: input.isActive,
          sort_order: count ?? 0,
        })
        .select("*")
        .single(),
    ) as MemberRow;
  });
}

export async function updateMemberAction(memberId: string, raw: Partial<z.input<typeof memberInput>>): Promise<ActionResult<MemberRow>> {
  return runAction("updateMember", async () => {
    const { supabase, household, member, isAdmin } = await requireMember();
    const id = parse(uuid, memberId);
    if (!isAdmin && id !== member.id) throw new UserError("Je kunt alleen je eigen profiel aanpassen.");
    const input = parse(memberInput.partial(), raw);
    return check(
      await supabase
        .from("household_members")
        .update({
          ...(input.displayName !== undefined && { display_name: input.displayName }),
          ...(input.color !== undefined && { color: input.color }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(input.email !== undefined && { email: input.email }),
          ...(isAdmin && input.role !== undefined && { role: input.role }),
          ...(isAdmin && input.isActive !== undefined && { is_active: input.isActive }),
        })
        .eq("id", id)
        .eq("household_id", household.id)
        .select("*")
        .single(),
    ) as MemberRow;
  });
}

export async function removeMemberAction(memberId: string): Promise<ActionResult<null>> {
  return runAction("removeMember", async () => {
    const { supabase, household, member } = await requireAdmin();
    const id = parse(uuid, memberId);
    if (id === member.id) throw new UserError("Je kunt jezelf niet verwijderen.");
    check(await supabase.from("household_members").delete().eq("id", id).eq("household_id", household.id));
    return null;
  });
}

// ---------------------------------------------------------------------------
// Uitnodigingen
// ---------------------------------------------------------------------------
export async function createInvitationAction(raw: {
  memberId?: string | null;
  email?: string | null;
  role?: "admin" | "member";
  sendEmail?: boolean;
}): Promise<ActionResult<{ url: string; emailed: boolean }>> {
  return runAction("createInvitation", async () => {
    const { supabase, household, member } = await requireAdmin();
    const input = parse(
      z.object({
        memberId: uuid.nullable().optional(),
        email: z.email("Ongeldig e-mailadres").nullable().optional().or(z.literal("").transform(() => null)),
        role: z.enum(["admin", "member"]).default("member"),
        sendEmail: z.boolean().default(false),
      }),
      raw,
    );
    const invitation = check(
      await supabase
        .from("household_invitations")
        .insert({
          household_id: household.id,
          member_id: input.memberId ?? null,
          email: input.email ?? null,
          role: input.role,
          invited_by_member_id: member.id,
        })
        .select("token")
        .single(),
    );
    const url = `${publicEnv.siteUrl}/invite/${invitation.token}`;

    // Optioneel direct een inloglink mailen die naar de uitnodiging leidt
    let emailed = false;
    if (input.sendEmail && input.email) {
      const { error } = await supabase.auth.signInWithOtp({
        email: input.email,
        options: {
          emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(`/invite/${invitation.token}`)}`,
          shouldCreateUser: true,
        },
      });
      emailed = !error;
    }
    return { url, emailed };
  });
}

export async function acceptInvitationAction(token: string, displayName?: string): Promise<ActionResult<string>> {
  return runAction("acceptInvitation", async () => {
    const { supabase, user } = await getUser();
    if (!user) throw new UserError("Log eerst in om de uitnodiging te accepteren.");
    const t = parse(z.string().regex(/^[a-f0-9]{64}$/, "Ongeldige uitnodiging"), token);
    const name = parse(z.string().trim().max(50).optional(), displayName);
    const householdId = check(await supabase.rpc("accept_invitation", { p_token: t, p_display_name: name || null })) as string;
    (await cookies()).set(HOUSEHOLD_COOKIE, householdId, appCookieOptions);
    return householdId;
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
        household_id: household.id,
        template_id: template.id,
        title: item.title ?? template.title,
        description: template.description,
        category: template.category,
        duration_minutes: template.duration_minutes,
        points: template.points,
        rule: item.rule,
        time_of_day: item.timeOfDay ?? template.default_time,
        starts_on: today,
        assignment_strategy: item.assignmentStrategy,
        fixed_member_id: item.assignmentStrategy === "fixed" ? (item.fixedMemberId ?? member.id) : null,
        rotation_member_ids: item.rotationMemberIds,
        created_by_member_id: member.id,
      };
    });

    const series = check(await supabase.from("task_recurrences").insert(rows).select("id"));
    const created = await topUpSeries(systemDb(supabase), household.id, { recurrenceIds: series.map((s) => s.id) });

    // Eén melding per persoon voor de eerstvolgende taak
    const first = new Map<string, (typeof created)[number]>();
    for (const task of created) {
      if (task.assigned_member_id && !first.has(task.assigned_member_id)) first.set(task.assigned_member_id, task);
    }
    await Promise.all([...first.values()].map((t) => notifyAssigned(t, member.id, supabase)));
    return series.length;
  });
}

// ---------------------------------------------------------------------------
// Afwezigheid / vakantie
// ---------------------------------------------------------------------------
export async function createAbsenceAction(raw: z.input<typeof absenceInput>): Promise<ActionResult<number>> {
  return runAction("createAbsence", async () => {
    const { supabase, household, member, isAdmin } = await requireMember();
    const input = parse(absenceInput, raw);
    if (!isAdmin && input.memberId !== member.id) throw new UserError("Je kunt alleen je eigen afwezigheid invoeren.");
    const absence = check(
      await supabase
        .from("member_absences")
        .insert({
          household_id: household.id,
          member_id: input.memberId,
          starts_on: input.startsOn,
          ends_on: input.endsOn,
          strategy: input.strategy,
          note: input.note,
          created_by_member_id: member.id,
        })
        .select("*")
        .single(),
    ) as AbsenceRow;
    const reassigned = await applyAbsence(systemDb(supabase), absence);
    await Promise.all(reassigned.map((t) => notifyAssigned(t, member.id, supabase)));
    return reassigned.length;
  });
}

export async function deleteAbsenceAction(absenceId: string): Promise<ActionResult<null>> {
  return runAction("deleteAbsence", async () => {
    const { supabase, household } = await requireMember();
    check(await supabase.from("member_absences").delete().eq("id", parse(uuid, absenceId)).eq("household_id", household.id));
    return null;
  });
}
