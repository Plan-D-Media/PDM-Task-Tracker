/**
 * App-wide constants shared by UI, seed script, and SQL expectations.
 * The default columns here MUST match the `seed_default_columns` trigger
 * in supabase/migrations/0003_triggers.sql (QA §12: 4 default columns).
 */

export type Role = "super_admin" | "admin" | "manager" | "member";
export type BoardVisibility = "private" | "department";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskPeriod = "daily" | "weekly" | "monthly" | "adhoc";
export type TaskType = "task" | "meeting" | "call";
export type NotificationType =
  | "deadline_breach"
  | "due_soon"
  | "assigned"
  | "mention"
  | "status_change"
  | "missed_threshold_warning"
  | "leaderboard_top";

/**
 * The 4 canonical columns created for every new board (Brief §5).
 * MUST match app.seed_default_columns() in migration 0006. Remarks is NOT
 * a status — it is the per-task comment thread.
 */
export const DEFAULT_COLUMNS = [
  { name: "To Do", color: "#3b82f6", is_done_column: false, is_cancelled_column: false }, // blue
  { name: "Work in Progress", color: "#f97316", is_done_column: false, is_cancelled_column: false }, // orange
  { name: "Completed", color: "#22c55e", is_done_column: true, is_cancelled_column: false }, // green
  { name: "Cancelled", color: "#9ca3af", is_done_column: false, is_cancelled_column: true }, // muted
] as const;

export const TASK_TYPE_META: Record<
  TaskType,
  { label: string; icon: "check-square" | "users" | "phone" }
> = {
  task: { label: "Task", icon: "check-square" },
  meeting: { label: "Meeting", icon: "users" },
  call: { label: "Call", icon: "phone" },
};

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
};

/** The 10 Plan D Media departments with seed headcount (§9). */
export const SEED_DEPARTMENTS: { name: string; color: string; staff: number }[] =
  [
    { name: "Paid Campaign", color: "#ef4444", staff: 7 },
    { name: "SEO", color: "#10b981", staff: 2 },
    { name: "Social Media", color: "#8b5cf6", staff: 4 },
    { name: "Website", color: "#0ea5e9", staff: 5 },
    { name: "Designer", color: "#ec4899", staff: 4 },
    { name: "Content", color: "#f59e0b", staff: 2 },
    { name: "HR", color: "#14b8a6", staff: 2 },
    { name: "YouTube", color: "#f43f5e", staff: 3 },
    { name: "Sales", color: "#6366f1", staff: 4 },
    { name: "Project Management", color: "#84cc16", staff: 4 },
  ];

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; color: string }
> = {
  low: { label: "Low", color: "#94a3b8" },
  medium: { label: "Medium", color: "#3b82f6" },
  high: { label: "High", color: "#f97316" },
  urgent: { label: "Urgent", color: "#ef4444" },
};

export const PERIOD_LABEL: Record<TaskPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  adhoc: "Ad-hoc",
};
