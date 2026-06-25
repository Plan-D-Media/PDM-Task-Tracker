-- ════════════════════════════════════════════════════════════════════
-- PlanDesk — 0004_grants.sql
-- Role grants. RLS decides WHICH rows; grants decide whether a role may
-- touch the table/function at all. Both are required.
--
-- IMPORTANT: RLS policies call app.is_admin() / app.can_read_board() etc.
-- Those calls run as the QUERYING role (`authenticated`), so that role
-- needs USAGE on schema `app` + EXECUTE on the helpers, or every policy
-- fails with "permission denied for schema app". The helpers are
-- SECURITY DEFINER, so once callable they read profiles/boards safely.
-- Note we grant schema USAGE but NOT table SELECT on app.settings, so
-- config stays invisible to end users.
-- ════════════════════════════════════════════════════════════════════

-- Access-control helpers (schema app)
grant usage on schema app to authenticated, service_role;
grant execute on all functions in schema app to authenticated, service_role;
alter default privileges in schema app
  grant execute on functions to authenticated, service_role;

-- Public tables: table-level grants for the authenticated role; RLS then
-- filters rows. anon gets schema usage only (every policy requires auth,
-- so anon sees nothing). Explicit here so local (CLI) and hosted behave
-- identically.
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete
  on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Sequences (defaults use gen_random_uuid(), but keep this for safety).
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
