# PlanDesk — Setup

## 1. Create a Supabase project

Either a hosted project (supabase.com) or local via the CLI:

```bash
# Local (needs Docker):
npx supabase init        # if supabase/config.toml not present
npx supabase start
```

## 2. Environment

Copy `.env.example` → `.env.local` and fill in from your Supabase project
(Project Settings → API):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, never expose.
- `CRON_SECRET`, `RESEND_API_KEY` (Phase 4), `NEXT_PUBLIC_SITE_URL`.

## 3. Apply the schema

Run the migrations **in order** against your database.

**Hosted:** paste each file in `supabase/migrations/` into the SQL editor
in order (0001 → 0004), or use the CLI:

```bash
npx supabase db push          # applies supabase/migrations/*
```

**Local CLI:**

```bash
npx supabase db reset         # re-applies all migrations from scratch
```

> The migrations create triggers on `auth.users` (profile bootstrap +
> email-domain gate). Run them as the project owner / `postgres` role.

## 4. Configure Auth (invite-only)

In the Supabase dashboard → Authentication:
- **Disable public sign-ups** (Providers → Email → "Allow new users to
  sign up" OFF). Members are admin-invited only (§2.1).
- Add `${NEXT_PUBLIC_SITE_URL}/auth/confirm` to **Redirect URLs**.
- The DB trigger `app.enforce_email_domain` rejects any non-agency email
  as defence in depth; change the domain in `app.settings`.

## 5. Seed

```bash
npm run seed        # 10 departments, admin + 37 staff, starter boards
```

Dev login for any seeded account: the email shown in the script output
(e.g. `admin@pland.in`) with password `PlanDesk#2026`. Production uses
magic-link; the password is dev-only.

## 6. Run + verify

```bash
npm run dev
# open http://localhost:3000  → redirected to /login

npm run verify:rls  # Phase-1 acceptance: §5 matrix holds at the API
```
