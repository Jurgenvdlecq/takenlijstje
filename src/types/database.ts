/**
 * Types van de database: het DOELSCHEMA na WP2b (TECHNICAL_DESIGN §3.1,
 * §12.3.1). Kolommen en tabellen die in …_210 vervallen, staan hier al niet
 * meer in, zodat een overgebleven verwijzing een typefout is en geen
 * runtimefout na het wissen.
 */
import type { RecurrenceRule } from "@/domain/recurrence/rule";

export type MemberRole = "admin" | "member";
export type TaskStatus = "todo" | "in_progress" | "done" | "skipped";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskCategory = "cleaning" | "laundry" | "groceries" | "kitchen" | "outdoor" | "pets" | "admin" | "other";
export type ShoppingCategory =
  | "produce" | "meat" | "dairy" | "bread" | "drinks" | "frozen" | "drugstore" | "household" | "other";
export type NotificationType =
  | "reminder" | "deadline_soon" | "overdue" | "task_completed" | "daily_summary" | "evening_summary";

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
  onboarding_completed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberRow = {
  id: string;
  household_id: string;
  user_id: string;
  display_name: string;
  color: string;
  icon: string | null;
  role: MemberRole;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type InvitationRow = {
  id: string;
  household_id: string;
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
  rule: RecurrenceRule;
  time_of_day: string | null;
  available_days_before: number;
  due_days_after: number;
  due_time: string | null;
  starts_on: string;
  ends_on: string | null;
  paused_from: string | null;
  paused_until: string | null;
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
  scheduled_date: string;
  scheduled_time: string | null;
  available_from: string | null;
  due_at: string | null;
  duration_minutes: number | null;
  reminder_minutes_before: number[];
  is_exception: boolean;
  completed_at: string | null;
  created_by_member_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CompletionRow = {
  id: string;
  household_id: string;
  task_id: string | null;
  recurrence_id: string | null;
  title: string;
  category: TaskCategory;
  completed_at: string;
  scheduled_date: string | null;
  due_at: string | null;
  was_late: boolean;
  minutes_late: number;
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
  /** Laatst bekende naam van de schrijver, gezet door de database (V-34) */
  author_name: string;
  body: string;
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
  notify_reminders: boolean;
  notify_deadline_soon: boolean;
  notify_overdue: boolean;
  notify_task_completed: boolean;
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
      task_completions: Table<CompletionRow>;
      task_comments: Table<CommentRow>;
      notifications: Table<NotificationRow>;
      push_subscriptions: Table<PushSubscriptionRow>;
      user_preferences: Table<PreferencesRow>;
      shopping_lists: Table<ShoppingListRow>;
      shopping_items: Table<ShoppingItemRow>;
    };
    Views: Record<never, never>;
    Functions: {
      create_household: {
        Args: { p_name: string; p_display_name: string; p_color?: string; p_icon?: string | null };
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
        };
        Returns: CompletionRow;
      };
      undo_complete_task: { Args: { p_task_id: string }; Returns: TaskRow };
      my_membership: {
        Args: Record<string, never>;
        Returns: { member_id: string; household_id: string; household_name: string; role: MemberRole; is_active: boolean }[];
      };
      clear_series_occurrences: {
        Args: { p_recurrence_id: string; p_from: string; p_until?: string | null; p_include_exceptions?: boolean };
        Returns: number;
      };
      pause_series: { Args: { p_recurrence_id: string; p_from: string; p_until: string | null }; Returns: RecurrenceRow };
      resume_series: { Args: { p_recurrence_id: string }; Returns: RecurrenceRow };
      stop_series: { Args: { p_recurrence_id: string }; Returns: boolean };
      delete_task: { Args: { p_task_id: string; p_scope?: "this" | "future" }; Returns: boolean };
      archive_shopping_list: { Args: { p_list_id: string }; Returns: ShoppingListRow };
      unarchive_shopping_list: { Args: { p_archived_list_id: string }; Returns: ShoppingListRow };
      delete_household: { Args: { p_confirm_name: string }; Returns: boolean };
      delete_my_account: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      member_role: MemberRole;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<never, never>;
  };
};
