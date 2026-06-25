-- ════════════════════════════════════════════════════════════════════
-- PlanDesk — 0001_schema.sql
-- Core tables, enums, indexes. (Brief §5)
-- UUID PKs, created_at/updated_at, soft-delete via archived_at.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;     -- gen_random_uuid()

-- Private schema for helper functions + config (kept out of the API).
create schema if not exists app;

-- ── Runtime config (admin-editable; read by triggers/RLS) ────────────
create table if not exists app.settings (
  key   text primary key,
  value text not null
);
-- Agency email domain gate (Brief §2.1). Change here to re-point the gate.
insert into app.settings (key, value)
values ('allowed_email_domain', 'pland.in')
on conflict (key) do nothing;

-- ── Enums ────────────────────────────────────────────────────────────
do $$ begin
  create type user_role         as enum ('admin', 'manager', 'member');
exception when duplicate_object then null; end $$;
do $$ begin
  create type board_visibility  as enum ('private', 'department');
exception when duplicate_object then null; end $$;
do $$ begin
  create type task_priority     as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;
do $$ begin
  create type task_period       as enum ('daily', 'weekly', 'monthly', 'adhoc');
exception when duplicate_object then null; end $$;
do $$ begin
  create type notification_type as enum
    ('deadline_breach', 'due_soon', 'assigned', 'mention', 'status_change');
exception when duplicate_object then null; end $$;

-- ── departments ──────────────────────────────────────────────────────
create table if not exists public.departments (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  color        text not null default '#64748b',
  head_user_id uuid,                       -- FK added after profiles exists
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── profiles (1:1 with auth.users) ───────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  email         text not null,
  avatar_url    text,
  role          user_role not null default 'member',
  department_id uuid references public.departments(id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.departments
  drop constraint if exists departments_head_user_id_fkey;
alter table public.departments
  add constraint departments_head_user_id_fkey
  foreign key (head_user_id) references public.profiles(id) on delete set null;

create index if not exists idx_profiles_department on public.profiles(department_id);
create index if not exists idx_profiles_role       on public.profiles(role);

-- ── boards (trackers / "spreadsheets") ───────────────────────────────
create table if not exists public.boards (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  visibility    board_visibility not null default 'department',
  created_by    uuid references public.profiles(id) on delete set null,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_boards_owner      on public.boards(owner_id);
create index if not exists idx_boards_department on public.boards(department_id);
create index if not exists idx_boards_visibility on public.boards(visibility);

-- ── board_columns (statuses) ─────────────────────────────────────────
create table if not exists public.board_columns (
  id             uuid primary key default gen_random_uuid(),
  board_id       uuid not null references public.boards(id) on delete cascade,
  name           text not null,
  color          text not null default '#94a3b8',
  position       integer not null default 0,
  is_done_column boolean not null default false,  -- the alarm's "done" anchor
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_columns_board on public.board_columns(board_id, position);

-- ── tasks (cards) ────────────────────────────────────────────────────
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.boards(id) on delete cascade,
  column_id    uuid not null references public.board_columns(id) on delete cascade,
  title        text not null,
  description  text,
  assignee_id  uuid references public.profiles(id) on delete set null,
  created_by   uuid references public.profiles(id) on delete set null,
  priority     task_priority not null default 'medium',
  period       task_period   not null default 'adhoc',
  start_date   timestamptz,
  due_date     timestamptz,
  completed_at timestamptz,
  position     integer not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_tasks_board       on public.tasks(board_id);
create index if not exists idx_tasks_column      on public.tasks(column_id, position);
create index if not exists idx_tasks_assignee    on public.tasks(assignee_id);
create index if not exists idx_tasks_due_date    on public.tasks(due_date);
-- Hot path for the deadline scanner: open, dated, not yet archived.
create index if not exists idx_tasks_open_due
  on public.tasks(due_date)
  where completed_at is null and archived_at is null;

-- ── task_comments (remarks) ──────────────────────────────────────────
create table if not exists public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_comments_task on public.task_comments(task_id, created_at);

-- ── task_attachments ─────────────────────────────────────────────────
create table if not exists public.task_attachments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  file_path   text not null,
  file_name   text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_attachments_task on public.task_attachments(task_id);

-- ── notifications ────────────────────────────────────────────────────
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  type          notification_type not null,
  task_id       uuid references public.tasks(id) on delete cascade,
  board_id      uuid references public.boards(id) on delete cascade,
  title         text not null,
  body          text,
  is_read       boolean not null default false,
  acknowledged_at timestamptz,             -- alarm "acknowledge"
  created_at    timestamptz not null default now()
);
create index if not exists idx_notif_recipient on public.notifications(recipient_id, is_read, created_at desc);

-- ── task_alarms (idempotency ledger; ONLY the scanner writes here) ────
create table if not exists public.task_alarms (
  id        uuid primary key default gen_random_uuid(),
  task_id   uuid not null references public.tasks(id) on delete cascade,
  level     text not null,               -- 'breach_1' | 'breach_2' | 'due_soon'
  fired_at  timestamptz not null default now(),
  -- guarantees the scanner can never double-fire the same level for a task
  unique (task_id, level)
);

-- ── activity_log ─────────────────────────────────────────────────────
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  entity_type text not null,             -- 'board' | 'task' | 'comment' | 'notification'
  entity_id   uuid,
  action      text not null,             -- 'created' | 'moved' | 'muted' | ...
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_activity_entity on public.activity_log(entity_type, entity_id, created_at desc);
create index if not exists idx_activity_actor  on public.activity_log(actor_id, created_at desc);
