/**
 * Hand-authored to mirror supabase/migrations. When the Supabase CLI is
 * wired up, regenerate with:
 *   supabase gen types typescript --local > src/lib/database.types.ts
 * Until then this stays the source of truth for the typed clients.
 *
 * NOTE: every row type below is a `type` alias, NOT an `interface`.
 * supabase-js's `GenericSchema` constraint requires each Row/Insert/Update
 * to be assignable to `Record<string, unknown>`; `interface` declarations
 * are not (they lack an implicit index signature), which silently
 * collapses every typed query to `never`. Keep these as `type`.
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
  | "status_change";

type Timestamps = { created_at: string; updated_at: string };

export type Department = Timestamps & {
  id: string;
  name: string;
  color: string;
  head_user_id: string | null;
};

export type Profile = Timestamps & {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: Role;
  department_id: string | null;
  is_active: boolean;
};

export type Board = Timestamps & {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  department_id: string | null;
  visibility: BoardVisibility;
  created_by: string | null;
  archived_at: string | null;
};

export type BoardColumn = Timestamps & {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  is_done_column: boolean;
  is_cancelled_column: boolean;
};

export type Task = Timestamps & {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  task_type: TaskType;
  assignee_id: string | null;
  created_by: string | null;
  priority: TaskPriority;
  period: TaskPeriod;
  start_date: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  position: number;
  archived_at: string | null;
};

export type TaskComment = Timestamps & {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  file_path: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  recipient_id: string;
  type: NotificationType;
  task_id: string | null;
  board_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
  acknowledged_at: string | null;
  created_at: string;
};

export type TaskAlarm = {
  id: string;
  task_id: string;
  level: string;
  fired_at: string;
};

export type ActivityLog = {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
};

/** Insert helper: makes db-defaulted columns optional. */
type Insert<T, Optional extends keyof T> = Omit<T, Optional> &
  Partial<Pick<T, Optional>>;

type DefaultCols = "id" | "created_at" | "updated_at";

/**
 * Table shape supabase-js expects. `Relationships: []` MUST be present or
 * inference collapses to `never`. Embedded-join shapes still need casting
 * (we don't enumerate FK relationships here).
 */
type Tbl<R, I, U> = { Row: R; Insert: I; Update: U; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      departments: Tbl<
        Department,
        Insert<Department, DefaultCols | "color" | "head_user_id">,
        Partial<Department>
      >;
      profiles: Tbl<
        Profile,
        Insert<
          Profile,
          DefaultCols | "full_name" | "avatar_url" | "role" | "department_id" | "is_active"
        >,
        Partial<Profile>
      >;
      boards: Tbl<
        Board,
        Insert<
          Board,
          DefaultCols | "description" | "department_id" | "visibility" | "created_by" | "archived_at"
        >,
        Partial<Board>
      >;
      board_columns: Tbl<
        BoardColumn,
        Insert<
          BoardColumn,
          DefaultCols | "color" | "position" | "is_done_column" | "is_cancelled_column"
        >,
        Partial<BoardColumn>
      >;
      tasks: Tbl<
        Task,
        Insert<
          Task,
          | DefaultCols
          | "description"
          | "task_type"
          | "assignee_id"
          | "created_by"
          | "priority"
          | "period"
          | "start_date"
          | "due_date"
          | "scheduled_start"
          | "scheduled_end"
          | "completed_at"
          | "cancelled_at"
          | "cancel_reason"
          | "position"
          | "archived_at"
        >,
        Partial<Task>
      >;
      task_comments: Tbl<
        TaskComment,
        Insert<TaskComment, DefaultCols>,
        Partial<TaskComment>
      >;
      task_attachments: Tbl<
        TaskAttachment,
        Insert<TaskAttachment, "id" | "created_at" | "uploaded_by">,
        Partial<TaskAttachment>
      >;
      notifications: Tbl<
        Notification,
        Insert<
          Notification,
          "id" | "created_at" | "is_read" | "acknowledged_at" | "body" | "task_id" | "board_id"
        >,
        Partial<Notification>
      >;
      task_alarms: Tbl<
        TaskAlarm,
        Insert<TaskAlarm, "id" | "fired_at">,
        Partial<TaskAlarm>
      >;
      activity_log: Tbl<
        ActivityLog,
        Insert<ActivityLog, "id" | "created_at" | "meta" | "actor_id" | "entity_id">,
        Partial<ActivityLog>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: Role;
      board_visibility: BoardVisibility;
      task_priority: TaskPriority;
      task_period: TaskPeriod;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
};
