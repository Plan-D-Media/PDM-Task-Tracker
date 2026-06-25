# PlanDesk — Build Progress

Internal task & project tracker for Plan D Media. Stack: Next.js 16 (App
Router, TS) · Tailwind v4 · Supabase (Postgres + Auth + RLS + Realtime) ·
TanStack Query · dnd-kit · Zod.

---

## ✅ Phase 0 — Scaffold & infra

- Next.js 16 + TypeScript + Tailwind v4, `src/` dir, `@/*` alias.
- Dependencies: `@supabase/supabase-js`, `@supabase/ssr`, TanStack Query,
  Zod, dnd-kit, lucide-react, sonner, react-hook-form, resend, papaparse,
  date-fns(-tz).
- Supabase wiring — three clients, strict separation:
  - `src/lib/supabase/client.ts` — browser (anon key, RLS-governed).
  - `src/lib/supabase/server.ts` — server (anon key + session cookies).
  - `src/lib/supabase/admin.ts` — **service role, `server-only`** (bypasses
    RLS; scanner/seed/invite only).
- `src/lib/env.ts` — split public/server env; server secrets throw if read
  in the browser.
- `src/proxy.ts` — session refresh + route guard (Next 16 proxy convention).
- TanStack Query + Toaster providers, base shadcn-style UI (button/input/
  label), brand theme + status-colour tokens in `globals.css`.
- `.env.example`, `.env.local` (placeholders, gitignored).

**Acceptance:** `npm run build` ✓ and `npm run lint` ✓ (clean). `/login`
renders; `/` and `/auth/confirm` are dynamic, session-guarded.

## ✅ Phase 1 — Schema, RLS, seed, auth

SQL migrations in `supabase/migrations/`:

- `0001_schema.sql` — all §5 tables, enums, UUID PKs, timestamps,
  `archived_at` soft-delete, indexes on due_date/column/assignee/board/dept
  (+ partial index for the scanner hot path). `app.settings` holds the
  agency email-domain gate.
- `0002_functions_triggers.sql` — SECURITY DEFINER access-control helpers
  (`is_admin`, `can_read_board`, `can_edit_board`, task variants); triggers:
  updated_at, board defaults, **4 default columns per board**, completed_at
  sync to the done column, new-user → profile, **email-domain enforcement**
  on auth.users.
- `0003_rls.sql` — RLS force-enabled on all 10 tables; policies implement
  the §5 matrix for boards/tasks/comments/attachments; notifications are
  recipient-private; **`task_alarms` has no write policy (scanner-only)**.
- `0004_grants.sql` — `authenticated` USAGE/EXECUTE on schema `app`
  (required for policies to call the helpers) + table grants.

Auth (invite-only, domain-restricted — §2.1):
- `src/lib/actions/auth.ts` — magic-link with `shouldCreateUser:false`
  (only pre-invited accounts can log in) + domain check.
- `src/lib/actions/invite.ts` — admin-only invite via service role.
- `src/app/auth/confirm/route.ts` — verifies OTP, mints session.
- `src/app/login/page.tsx` — login screen.
- `src/lib/auth.ts` — `requireProfile()` guard for server components.

Seed (`scripts/seed.mjs`): 10 departments, 1 admin + 37 staff (first of
each dept = manager/head), a starter board per member with sample
daily/weekly/monthly tasks (one intentionally overdue for Phase-4).

**Acceptance:** verified statically (build/lint/§11 greps). Runtime matrix
test — `npm run verify:rls` — is ready to run once a Supabase project is
connected (see SETUP.md). It signs in as an SEO member, a Sales outsider,
and an admin and asserts the §5 matrix at the API.

### House Rule §11 self-checks (passing)
- RLS enabled on all 10 tables.
- `SUPABASE_SERVICE_ROLE_KEY` referenced only in server env accessor;
  `admin.ts` guarded by `server-only`; never `NEXT_PUBLIC_*`.
- No `task_alarms` writer in `src/`; no insert/update/delete RLS policy on it.

---

## ✅ Phase 2 — Board UI: Kanban, Table, task & column CRUD

Schema (additive — `ALTER`, never rebuild):
- `0005_phase2_role.sql` — adds `super_admin` to `user_role` in its own
  migration (a new enum value can't be added and used in one transaction).
- `0006_phase2_schema.sql` — `task_type` enum (task/meeting/call);
  `board_columns.is_cancelled_column`; task scheduling + cancellation
  columns; **canonical columns are now To Do · WIP · Completed · Cancelled**
  (Remarks demoted to the comment thread); `sync_task_state` trigger stamps
  `completed_at`/`cancelled_at` from the done/cancelled column — the single
  source of truth the alarm (§9) and scoring (§12) read. `is_admin()` now
  covers `super_admin`; `is_super_admin()` added for the §7 leaderboard gate.
- Seed: founder = `super_admin`, plus a plain `admin` for §7 boundary tests.

Data layer (browser client = RLS-governed):
- `src/lib/queries/board-data.ts` — TanStack Query hooks: `useBoardData`,
  `useProfiles`, task CRUD (`useCreateTask`/`useUpdateTask`/`useCancelTask`/
  `useArchiveTask`), `useReorderTasks` (optimistic within- AND cross-column),
  column CRUD, and the comments thread.
- `src/lib/actions/boards.ts` — `createBoard` / `archiveBoard` server actions
  (owner = caller; the AFTER-INSERT trigger seeds the 4 columns).
- `src/lib/nav.ts` (sidebar boards, RLS-scoped) · `src/lib/dates.ts`
  (Asia/Kolkata formatting + overdue/due-soon helpers).

UI:
- `(app)` route group with a persistent sidebar shell (`app-sidebar.tsx`,
  `create-board-dialog.tsx`). `/` = dashboard board grid; `/board/[boardId]`
  = the tracker (404s through RLS if unreadable/archived).
- `board-view.tsx` — Board/Table tab switch + the task detail sheet.
- `kanban.tsx` + `kanban-column.tsx` + `task-card.tsx` — dnd-kit board
  (DragOverlay, 8px activation so clicks still open the sheet), inline
  add-task, column menu (rename/delete, canonical guarded), add-column.
- `table-view.tsx` — sortable flat table.
- `task-sheet.tsx` — edit all task fields, cancel (with reason) / archive,
  and the Remarks comment thread.
- shadcn-style primitives added: dialog/sheet, select, tabs, dropdown-menu,
  avatar, badge, textarea.

**Acceptance:** `npm run build` ✓, `npm run lint` ✓ (clean), `tsc` ✓.
§11 greps still pass (no service key in client code; no `task_alarms`
writer). Runtime DB behaviour pending a connected Supabase project.

---

## ⏳ Next

- **Phase 3** — Visibility/Add-Tracker + CSV import.
- **Phase 4** — Deadline alarm scanner (the spine).
- **Phase 5** — Dashboards & global views.
- **Phase 6** — Polish & QA.
