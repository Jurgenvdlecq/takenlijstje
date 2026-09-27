/**
 * Types van de database (spiegelt supabase/migrations).
 * Kan later vervangen worden door `supabase gen types typescript`.
 */
import type { RecurrenceRule } from "@/domain/recurrence/rule";

export type MemberRole = "admin" | "member";
export type TaskStatus = "todo" | "in_progress" | "done" | "skipped";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type AssignmentStrategy = "none" | "fixed" | "rotation" | "random" | "fair";
export type AbsenceStrategy = "reassign" | "postpone" | "unassign";
export type TaskCategory = "cleaning" | "laundry" | "groceries" | "kitchen" | "outdoor" | "pets" | "admin" | "other";
export type ShoppingCategory =
  | "produce" | "meat" | "dairy" | "bread" | "drinks" | "frozen" | "drugstore" | "household" | "other";
export type NotificationType =
  | "task_assigned" | "reminder" | "deadline_soon" | "overdue" | "task_completed"
  | "daily_summary" | "evening_summary" | "swap_request" | "swap_accepted";
export type AssignmentReason = "manual" | "fixed" | "rotation" | "random" | "fair" | "swap" | "absence";

export type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
};

export type HouseholdRow = {
  id: string;
  name: string;
  timezone: string;
  members_can_create_tasks: boolean;
  members_can_assign_others: boolean;
  points_enabled: boolean;
  points_goal: number | null;
  points_goal_reward: string | null;
  onboarding_completed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberRow = {
  id: string;
  household_id: string;
  user_id: string | null;
  display_name: string;
  avatar_url: string | null;
  color: string;
  icon: string | null;
  role: MemberRole;
  is_active: boolean;
  email: string | null;
  sort_order: number;
  created_at: string;
};

export type InvitationRow = {
  id: string;
  household_id: string;
  member_id: string | null;
  email: string | null;
  role: MemberRole;
  token: string;
  invited_by_member_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
};

export type TemplateRow = {
  id: string;
  household_id: string | null;
  slug: string | null;
  category: TaskCategory;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  points: number | null;
  default_rule: RecurrenceRule | null;
  default_time: string | null;
  icon: string | null;
  keywords: string[];
  popular: boolean;
  sort_order: number;
  created_at: string;
};

export type RecurrenceRow = {
  id: string;
  household_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  duration_minutes: number | null;
  points: number | null;
  rule: RecurrenceRule;
  time_of_day: string | null;
  available_days_before: number;
  due_days_after: number;
  due_time: string | null;
  starts_on: string;
  ends_on: string | null;
  paused_from: string | null;
  paused_until: string | null;
  assignment_strategy: AssignmentStrategy;
  fixed_member_id: string | null;
  rotation_member_ids: string[];
  reminder_minutes_before: number[];
  is_active: boolean;
  generated_until: string | null;
  created_by_member_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  household_id: string;
  recurrence_id: string | null;
  occurrence_date: string | null;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_member_id: string | null;
  assignment_reason: AssignmentReason | null;
  scheduled_date: string;
  scheduled_time: string | null;
  available_from: string | null;
  due_at: string | null;
  duration_minutes: number | null;
  points: number | null;
  reminder_minutes_before: number[];
  is_exception: boolean;
  completed_at: string | null;
  completed_by_member_id: string | null;
  created_by_member_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignmentRow = {
  id: string;
  household_id: string;
  task_id: string;
  member_id: string | null;
  assigned_by_member_id: string | null;
  reason: AssignmentReason | "unassigned";
  created_at: string;
};

export type SwapRequestRow = {
  id: string;
  household_id: string;
  task_id: string;
  requested_by_member_id: string;
  status: "open" | "accepted" | "cancelled";
  message: string | null;
  accepted_by_member_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type CompletionRow = {
  id: string;
  household_id: string;
  task_id: string | null;
  recurrence_id: string | null;
  title: string;
  category: TaskCategory;
  member_id: string | null;
  completed_at: string;
  scheduled_date: string | null;
  due_at: string | null;
  was_late: boolean;
  minutes_late: number;
  points: number;
  duration_minutes: number | null;
  note: string | null;
  client_mutation_id: string | null;
  created_at: string;
};

export type CommentRow = {
  id: string;
  household_id: string;
  task_id: string;
  member_id: string | null;
  body: string;
  created_at: string;
};

export type AbsenceRow = {
  id: string;
  household_id: string;
  member_id: string;
  starts_on: string;
  ends_on: string;
  strategy: AbsenceStrategy;
  note: string | null;
  created_by_member_id: string | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  household_id: string;
  member_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  task_id: string | null;
  url: string | null;
  dedupe_key: string | null;
  read_at: string | null;
  pushed_at: string | null;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type PreferencesRow = {
  member_id: string;
  household_id: string;
  push_enabled: boolean;
  notify_task_assigned: boolean;
  notify_reminders: boolean;
  notify_deadline_soon: boolean;
  notify_overdue: boolean;
  notify_task_completed: boolean;
  notify_swap_requests: boolean;
  daily_summary_enabled: boolean;
  daily_summary_time: string;
  evening_summary_enabled: boolean;
  evening_summary_time: string;
  deadline_warning_minutes: number;
  updated_at: string;
};

export type ShoppingListRow = {
  id: string;
  household_id: string;
  name: string;
  archived_at: string | null;
  created_by_member_id: string | null;
  created_at: string;
};

export type ShoppingItemRow = {
  id: string;
  household_id: string;
  list_id: string;
  name: string;
  quantity: string | null;
  category: ShoppingCategory;
  note: string | null;
  is_bought: boolean;
  bought_at: string | null;
  added_by_member_id: string | null;
  bought_by_member_id: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Supabase-generiek type
// ---------------------------------------------------------------------------
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: Table<UserRow>;
      households: Table<HouseholdRow>;
      household_members: Table<MemberRow>;
      household_invitations: Table<InvitationRow>;
      task_templates: Table<TemplateRow>;
      task_recurrences: Table<RecurrenceRow>;
      tasks: Table<TaskRow>;
      task_assignments: Table<AssignmentRow>;
      task_swap_requests: Table<SwapRequestRow>;
      task_completions: Table<CompletionRow>;
      task_comments: Table<CommentRow>;
      member_absences: Table<AbsenceRow>;
      notifications: Table<NotificationRow>;
      push_subscriptions: Table<PushSubscriptionRow>;
      user_preferences: Table<PreferencesRow>;
      shopping_lists: Table<ShoppingListRow>;
      shopping_items: Table<ShoppingItemRow>;
    };
    Views: Record<never, never>;
    Functions: {
      create_household: {
        Args: { p_name: string; p_display_name: string; p_color?: string; p_icon?: string | null; p_timezone?: string };
        Returns: string;
      };
      accept_invitation: { Args: { p_token: string; p_display_name?: string | null }; Returns: string };
      get_invitation: {
        Args: { p_token: string };
        Returns: { household_name: string; invited_by: string | null; email: string | null; expires_at: string }[];
      };
      complete_task: {
        Args: {
          p_task_id: string;
          p_mutation_id: string;
          p_note?: string | null;
          p_completed_at?: string | null;
          p_completed_by?: string | null;
        };
        Returns: CompletionRow;
      };
      undo_complete_task: { Args: { p_task_id: string }; Returns: TaskRow };
      accept_swap_request: { Args: { p_request_id: string }; Returns: TaskRow };
    };
    Enums: {
      member_role: MemberRole;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      assignment_strategy: AssignmentStrategy;
      absence_strategy: AbsenceStrategy;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<never, never>;
  };
};
