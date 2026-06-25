# Migrations — present vs applied

Source of truth for which SQL migrations exist and which are live on the
connected Supabase project. **Update the Applied column whenever you run a
file in the SQL Editor.** Apply strictly in numeric order.

> How "Applied" was last verified: querying the live DB for each migration's
> objects (columns, enum values, trigger output) — not by assumption.
> Last reconciled: **2026-06-25**.

| #    | File                          | Phase | Applied | Purpose (one line) |
|------|-------------------------------|-------|---------|--------------------|
| 0001 | `0001_schema.sql`             | 1     | ✅ yes  | All §5 tables, enums, indexes, `app.settings` email-domain gate, soft-delete columns. |
| 0002 | `0002_functions_triggers.sql` | 1     | ✅ yes  | SECURITY DEFINER access helpers (`is_admin`, `can_read/edit_*`); triggers: updated_at, **default columns**, completed_at sync, new-user→profile, email-domain enforcement. |
| 0003 | `0003_rls.sql`                | 1     | ✅ yes  | RLS force-enabled on all 10 tables; §5 visibility-matrix policies; `task_alarms` has **no write policy** (scanner-only). |
| 0004 | `0004_grants.sql`             | 1     | ✅ yes  | `authenticated` USAGE/EXECUTE on schema `app` (policies call its helpers) + table grants. |
| 0005 | `0005_phase2_role.sql`        | 2     | ✅ yes  | Adds `super_admin` enum value to `user_role`. **Must be its own migration** — a new enum value can't be added and used in one transaction. |
| 0006 | `0006_phase2_schema.sql`      | 2     | ✅ yes  | `task_type` enum; `board_columns.is_cancelled_column`; task scheduling/cancel columns; **replaces the canonical-status trigger** (To Do / Work in Progress / Completed / Cancelled); `sync_task_state` (stamps completed_at/cancelled_at); `is_admin()`+`is_super_admin()`. |

## Status verdict (2026-06-25)

- **All migrations 0001–0006 are present AND applied.** No schema gap.
- **The canonical-status trigger** (To Do / Work in Progress / Completed /
  Cancelled) lives in **0006** — a `create or replace` of
  `app.seed_default_columns()` (0002 had the older To Do / WIP / Complete /
  Remarks names). 0006 is applied: verified live by the presence of
  `board_columns.is_cancelled_column`, `tasks.task_type`, and all 37 seeded
  boards carrying the new column names/flags.
- **Nothing for the human to run right now.** The earlier "run 0001→0004"
  instruction predates Phase 2; 0005–0006 were added for Phase 2 and have
  since been applied.

## Later-phase migrations — DO NOT apply yet

None exist yet. Phases 3–6 (visibility/import, **deadline-alarm scanner**,
dashboards/scoring, calendar/.ics, people-management, warnings) will add
`0007+`. When they land, list them here with **Applied = ❌ no** until the
relevant phase is green-lit, and apply them only then — in order.
