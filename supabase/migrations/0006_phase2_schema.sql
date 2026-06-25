-- ════════════════════════════════════════════════════════════════════
-- PlanDesk — 0006_phase2_schema.sql
-- Phase 2 schema: task types, the Cancelled canonical status, scheduling
-- + cancel fields, and the trigger/policy updates that depend on them.
-- All ADDITIVE (Brief BUILD STATUS: ALTER existing tables, don't rebuild).
-- ════════════════════════════════════════════════════════════════════

-- ── Task type (Brief §5) ─────────────────────────────────────────────
do $$ begin
  create type task_type as enum ('task', 'meeting', 'call');
exception when duplicate_object then null; end $$;

-- ── board_columns: the Cancelled anchor (Brief §5/§6) ────────────────
alter table public.board_columns
  add column if not exists is_cancelled_column boolean not null default false;

-- ── tasks: type, scheduling, cancellation (Brief §5/§6) ──────────────
alter table public.tasks
  add column if not exists task_type       task_type   not null default 'task',
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end   timestamptz,
  add column if not exists cancelled_at    timestamptz,
  add column if not exists cancel_reason   text;

create index if not exists idx_tasks_type      on public.tasks(task_type);
create index if not exists idx_tasks_scheduled on public.tasks(scheduled_start);

-- ── super_admin inherits admin power everywhere is_admin() is used ────
create or replace function app.is_admin()
returns boolean
language sql stable security definer set search_path = public, app
as $$
  select coalesce(
    (select role in ('admin', 'super_admin') from public.profiles
       where id = auth.uid() and is_active), false)
$$;

-- Sole-leaderboard gate used from Phase 8 onward (Brief §7). Defined now
-- so role logic lives in one place.
create or replace function app.is_super_admin()
returns boolean
language sql stable security definer set search_path = public, app
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles
       where id = auth.uid() and is_active), false)
$$;

-- ── New canonical default columns: To Do · WIP · Completed · Cancelled ─
-- (Remarks is NOT a status — it's the comment thread. Brief §5.)
create or replace function app.seed_default_columns()
returns trigger language plpgsql security definer set search_path = public, app
as $$
begin
  insert into public.board_columns
    (board_id, name, color, position, is_done_column, is_cancelled_column)
  values
    (new.id, 'To Do',             '#3b82f6', 0, false, false),
    (new.id, 'Work in Progress',  '#f97316', 1, false, false),
    (new.id, 'Completed',         '#22c55e', 2, true,  false),
    (new.id, 'Cancelled',         '#9ca3af', 3, false, true);
  return new;
end $$;

-- ── Migrate boards seeded under the old (Phase-1) defaults ────────────
-- 'Complete' → 'Completed'; the old non-status 'Remarks' column becomes
-- the 'Cancelled' canonical column. Safe: Phase-1 seed put no tasks in
-- Remarks. Guarded so it only touches the old default shapes.
update public.board_columns
  set name = 'Completed'
  where name = 'Complete' and is_done_column;

update public.board_columns
  set name = 'Work in Progress'
  where name = 'WIP';

update public.board_columns
  set name = 'Cancelled', color = '#9ca3af', is_cancelled_column = true
  where name = 'Remarks' and is_cancelled_column = false;

-- ── Replace completion trigger with done/cancelled state sync ─────────
-- Moving INTO the done column stamps completed_at; INTO the cancelled
-- column stamps cancelled_at; moving elsewhere clears both. This is the
-- single source of truth the alarm (§9) and scoring (§12) rely on.
create or replace function app.sync_task_state()
returns trigger language plpgsql security definer set search_path = public, app
as $$
declare done boolean; cancelled boolean;
begin
  select is_done_column, is_cancelled_column into done, cancelled
    from public.board_columns where id = new.column_id;

  if done then
    if new.completed_at is null then new.completed_at := now(); end if;
    new.cancelled_at := null;
  elsif cancelled then
    if new.cancelled_at is null then new.cancelled_at := now(); end if;
    new.completed_at := null;
  else
    new.completed_at := null;
    new.cancelled_at := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_completion on public.tasks;
drop trigger if exists trg_sync_state on public.tasks;
create trigger trg_sync_state
  before insert or update of column_id on public.tasks
  for each row execute function app.sync_task_state();

-- Keep grants current for any newly created app functions.
grant execute on all functions in schema app to authenticated, service_role;
