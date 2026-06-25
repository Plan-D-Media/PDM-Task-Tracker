-- ════════════════════════════════════════════════════════════════════
-- PlanDesk — 0005_phase2_role.sql
-- Adds the super_admin tier (Brief §3). MUST be its own migration: a new
-- enum value cannot be added and then used in the SAME transaction, so the
-- value is committed here before 0006 references it.
-- ════════════════════════════════════════════════════════════════════
alter type user_role add value if not exists 'super_admin' before 'admin';
