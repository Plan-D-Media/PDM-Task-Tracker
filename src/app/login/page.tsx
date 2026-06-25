"use client";

import { useActionState } from "react";
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { devSignIn, sendMagicLink, type LoginState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = { ok: false, message: "" };

/**
 * Inlined here (rather than imported) ON PURPOSE: referencing `process.env`
 * literals in this module lets the production build statically fold this to
 * `false` and dead-code-eliminate `<DevLogin />` entirely — so the dev form
 * is not just hidden but absent from the prod client bundle. The server
 * action re-checks the same gate via `@/lib/dev` for runtime safety.
 */
const DEV_LOGIN_ENABLED = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState,
  );

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-primary p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <div className="grid size-8 place-items-center rounded-md bg-white/20">
            PD
          </div>
          PlanDesk
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">
            Your priorities, organised.
          </h1>
          <p className="max-w-md text-white/80">
            Boards, deadlines, and alarms for every Plan D Media team — from
            Paid Campaign to Project Management. Members only.
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm text-white/70">
          <ShieldCheck className="size-4" /> Invite-only · agency accounts
        </p>
      </div>

      {/* Auth form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-semibold">Sign in to PlanDesk</h2>
            <p className="text-sm text-muted-foreground">
              Enter your agency email and we&apos;ll send a secure sign-in
              link.
            </p>
          </div>

          {state.ok ? (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-accent p-4 text-sm text-accent-foreground">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <p>{state.message}</p>
            </div>
          ) : (
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@pland.in"
                    className="pl-9"
                  />
                </div>
                {state.message && !state.ok && (
                  <p className="text-sm text-destructive">
                    {state.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Sending link…" : "Send sign-in link"}
              </Button>
            </form>
          )}

          <p className="text-center text-xs text-muted-foreground">
            No account? Ask an admin to invite you — there is no public signup.
          </p>

          {DEV_LOGIN_ENABLED && <DevLogin />}
        </div>
      </div>
    </main>
  );
}

/**
 * DEV-ONLY password sign-in. Gated by `DEV_LOGIN_ENABLED`, so it is
 * tree-shaken out of production client bundles. Magic-link above remains
 * the production path, untouched.
 */
function DevLogin() {
  const [state, formAction, pending] = useActionState(devSignIn, initialState);

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border bg-(--muted)/40 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <KeyRound className="size-3.5" /> Dev sign-in (local only)
      </div>
      <form action={formAction} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="dev-email">Email</Label>
          <Input
            id="dev-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue="admin@pland.in"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dev-password">Password</Label>
          <Input
            id="dev-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            defaultValue="PlanDesk#2026"
          />
        </div>
        {state.message && !state.ok && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}
        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={pending}
        >
          {pending ? "Signing in…" : "Dev sign in"}
        </Button>
      </form>
      <p className="text-center text-[11px] text-muted-foreground">
        Seeded accounts use password <code>PlanDesk#2026</code>.
      </p>
    </div>
  );
}
