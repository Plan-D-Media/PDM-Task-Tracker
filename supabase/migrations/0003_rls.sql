-- ════════════════════════════════════════════════════════════════════
-- PlanDesk — 0003_rls.sql
-- Row Level Security. This file IS the access-control model (Brief §5).
-- Every table is force-enabled; nothing is readable/writable except via
-- the policies below. The anon/auth clients can never bypass these; only
-- the service-role key (server-only, scanner/seed/invite) can.
-- ════════════════════════════════════════════════════════════════════

alter table public.departments     enable row level security;
alter table public.profiles        enable row level security;
alter table public.boards          enable row level security;
alter table public.board_columns   enable row level security;
alter table public.tasks           enable row level security;
alter table public.task_comments   enable row level security;
alter table public.task_attachments enable row level security;
alter table public.notifications   enable row level security;
alter table public.task_alarms     enable row level security;
alter table public.activity_log    enable row level security;

-- Helper: clean re-runs.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ── departments ──────────────────────────────────────────────────────
create policy departments_select on public.departments
  for select to authenticated using (true);
create policy departments_write on public.departments
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- ── profiles ─────────────────────────────────────────────────────────
-- Internal tool: any signed-in user can read the staff directory (needed
-- for assignee pickers + dashboards). Writes: self or admin.
create policy profiles_select on public.profiles
  for select to authenticated using (auth.uid() is not null);
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or app.is_admin())
  with check (id = auth.uid() or app.is_admin());
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- ── boards (the §5 matrix) ───────────────────────────────────────────
create policy boards_select on public.boards
  for select to authenticated using (app.can_read_board(id));
create policy boards_insert on public.boards
  for insert to authenticated
  with check (app.is_admin() or owner_id = auth.uid());
create policy boards_update on public.boards
  for update to authenticated
  using (app.can_edit_board(id)) with check (app.can_edit_board(id));
create policy boards_delete on public.boards
  for delete to authenticated
  using (app.is_admin() or owner_id = auth.uid());

-- ── board_columns (follow the parent board) ──────────────────────────
create policy columns_select on public.board_columns
  for select to authenticated using (app.can_read_board(board_id));
create policy columns_write on public.board_columns
  for all to authenticated
  using (app.can_edit_board(board_id))
  with check (app.can_edit_board(board_id));

-- ── tasks (read = read board; write = edit board) ────────────────────
create policy tasks_select on public.tasks
  for select to authenticated using (app.can_read_board(board_id));
create policy tasks_insert on public.tasks
  for insert to authenticated with check (app.can_edit_board(board_id));
create policy tasks_update on public.tasks
  for update to authenticated
  using (app.can_edit_board(board_id)) with check (app.can_edit_board(board_id));
create policy tasks_delete on public.tasks
  for delete to authenticated using (app.can_edit_board(board_id));

-- ── task_comments (remarks) ──────────────────────────────────────────
-- ASSUMPTION (noted, does not alter the board/task access model): anyone
-- who can READ the board may post a remark — the comment stream is meant
-- to be collaborative, incl. read-only dept-mates. Edit/delete own only
-- (or admin).
create policy comments_select on public.task_comments
  for select to authenticated using (app.can_read_task(task_id));
create policy comments_insert on public.task_comments
  for insert to authenticated
  with check (author_id = auth.uid() and app.can_read_task(task_id));
create policy comments_update on public.task_comments
  for update to authenticated
  using (author_id = auth.uid() or app.is_admin())
  with check (author_id = auth.uid() or app.is_admin());
create policy comments_delete on public.task_comments
  for delete to authenticated
  using (author_id = auth.uid() or app.is_admin());

-- ── task_attachments (uploading is an edit) ──────────────────────────
create policy attachments_select on public.task_attachments
  for select to authenticated using (app.can_read_task(task_id));
create policy attachments_insert on public.task_attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid() and app.can_edit_task(task_id));
create policy attachments_delete on public.task_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid() or app.can_edit_task(task_id) or app.is_admin());

-- ── notifications (recipient-private) ────────────────────────────────
-- No INSERT policy on purpose: only the service-role scanner (which
-- bypasses RLS) creates notifications. Users may read/ack/delete theirs.
create policy notif_select on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
create policy notif_update on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notif_delete on public.notifications
  for delete to authenticated using (recipient_id = auth.uid());

-- ── task_alarms (idempotency ledger) ─────────────────────────────────
-- House Rule §11: the scanner (service role) is the ONLY writer. No
-- insert/update/delete policy exists, so the anon/auth role is hard-
-- denied. Admins may read it for debugging.
create policy alarms_select on public.task_alarms
  for select to authenticated using (app.is_admin());

-- ── activity_log ─────────────────────────────────────────────────────
create policy activity_select on public.activity_log
  for select to authenticated
  using (app.is_admin() or actor_id = auth.uid());
create policy activity_insert on public.activity_log
  for insert to authenticated with check (actor_id = auth.uid());
