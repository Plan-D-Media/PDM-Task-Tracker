-- ════════════════════════════════════════════════════════════════════
-- PlanDesk — 0002_functions_triggers.sql
-- SECURITY DEFINER access-control helpers (used by RLS in 0003) and the
-- triggers that keep the schema's invariants true.
--
-- WHY SECURITY DEFINER: these helpers read profiles/boards to make access
-- decisions. If they were SECURITY INVOKER they'd re-trigger RLS on those
-- tables → infinite recursion. As DEFINER they run with the function
-- owner's rights, breaking the cycle. They expose only booleans/ids.
-- ════════════════════════════════════════════════════════════════════

-- ── Who am I? ────────────────────────────────────────────────────────
create or replace function app.role_of(uid uuid)
returns user_role
language sql stable security definer set search_path = public, app
as $$ select role from public.profiles where id = uid $$;

create or replace function app.dept_of(uid uuid)
returns uuid
language sql stable security definer set search_path = public, app
as $$ select department_id from public.profiles where id = uid $$;

create or replace function app.is_admin()
returns boolean
language sql stable security definer set search_path = public, app
as $$
  select coalesce(
    (select role = 'admin' from public.profiles
       where id = auth.uid() and is_active), false)
$$;

-- ── Board read/edit decisions (the §5 visibility matrix) ─────────────
-- READ: admin OR owner OR creator OR (department-visible & same dept).
create or replace function app.can_read_board(b_id uuid)
returns boolean
language sql stable security definer set search_path = public, app
as $$
  select exists (
    select 1 from public.boards b
    where b.id = b_id
      and b.archived_at is null
      and (
        app.is_admin()
        or b.owner_id   = auth.uid()
        or b.created_by = auth.uid()
        or (b.visibility = 'department'
            and b.department_id = app.dept_of(auth.uid()))
      )
  )
$$;

-- EDIT: admin OR owner OR (manager of the board's department, dept-visible).
-- Private boards stay owner+admin only (Brief §2.4).
create or replace function app.can_edit_board(b_id uuid)
returns boolean
language sql stable security definer set search_path = public, app
as $$
  select exists (
    select 1 from public.boards b
    where b.id = b_id
      and b.archived_at is null
      and (
        app.is_admin()
        or b.owner_id = auth.uid()
        or (app.role_of(auth.uid()) = 'manager'
            and b.visibility = 'department'
            and b.department_id = app.dept_of(auth.uid()))
      )
  )
$$;

-- Task-level helpers resolve the task's board, then defer to the above.
create or replace function app.can_read_task(t_id uuid)
returns boolean
language sql stable security definer set search_path = public, app
as $$
  select app.can_read_board((select board_id from public.tasks where id = t_id))
$$;

create or replace function app.can_edit_task(t_id uuid)
returns boolean
language sql stable security definer set search_path = public, app
as $$
  select app.can_edit_board((select board_id from public.tasks where id = t_id))
$$;

-- ════════════════════════════════════════════════════════════════════
-- Triggers
-- ════════════════════════════════════════════════════════════════════

-- ── updated_at bumper ────────────────────────────────────────────────
create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'departments','profiles','boards','board_columns','tasks',
    'task_comments'
  ] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s
         for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;

-- ── Board defaults: fill created_by + department from the owner ───────
create or replace function app.set_board_defaults()
returns trigger language plpgsql security definer set search_path = public, app
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if new.department_id is null then
    new.department_id := app.dept_of(new.owner_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_board_defaults on public.boards;
create trigger trg_board_defaults
  before insert on public.boards
  for each row execute function app.set_board_defaults();

-- ── Seed the 4 default columns on every new board (Brief §2.6 / §7) ──
-- MUST stay in sync with DEFAULT_COLUMNS in src/lib/constants.ts.
create or replace function app.seed_default_columns()
returns trigger language plpgsql security definer set search_path = public, app
as $$
begin
  insert into public.board_columns (board_id, name, color, position, is_done_column)
  values
    (new.id, 'To Do',   '#3b82f6', 0, false),
    (new.id, 'WIP',     '#f97316', 1, false),
    (new.id, 'Complete','#22c55e', 2, true),
    (new.id, 'Remarks', '#94a3b8', 3, false);
  return new;
end $$;

drop trigger if exists trg_seed_columns on public.boards;
create trigger trg_seed_columns
  after insert on public.boards
  for each row execute function app.seed_default_columns();

-- ── Keep completed_at in lockstep with the done column ───────────────
-- Moving a task INTO the board's is_done_column stamps completed_at;
-- moving it OUT clears it. This is what the dashboards + alarm rely on.
create or replace function app.sync_task_completion()
returns trigger language plpgsql security definer set search_path = public, app
as $$
declare done boolean;
begin
  select is_done_column into done from public.board_columns where id = new.column_id;
  if done then
    if new.completed_at is null then new.completed_at := now(); end if;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_completion on public.tasks;
create trigger trg_sync_completion
  before insert or update of column_id on public.tasks
  for each row execute function app.sync_task_completion();

-- ── New auth user → ensure a profile exists ──────────────────────────
-- Invites create the profile with the right role/department up front
-- (see src/lib/actions/invite). This trigger is a safety net so a login
-- never 500s on a missing profile; role defaults to 'member'.
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, app
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'member'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ── Enforce agency email domain at the DB edge (Brief §2.1) ──────────
-- Defence-in-depth alongside invite-only auth + the app-layer check.
create or replace function app.enforce_email_domain()
returns trigger language plpgsql security definer set search_path = public, app
as $$
declare allowed text;
begin
  select value into allowed from app.settings where key = 'allowed_email_domain';
  if allowed is not null
     and lower(split_part(new.email, '@', 2)) <> lower(allowed) then
    raise exception 'Email domain not permitted: %', new.email
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_domain on auth.users;
create trigger trg_enforce_domain
  before insert on auth.users
  for each row execute function app.enforce_email_domain();
