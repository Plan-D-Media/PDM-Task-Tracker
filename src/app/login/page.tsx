"use client";

import { useActionState } from "react";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { sendMagicLink, type LoginState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = { ok: false, message: "" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState,
  );

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-[var(--primary)] p-12 text-white lg:flex">
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
            <p className="text-sm text-[var(--muted-foreground)]">
              Enter your agency email and we&apos;ll send a secure sign-in
              link.
            </p>
          </div>

          {state.ok ? (
            <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--accent)] p-4 text-sm text-[var(--accent-foreground)]">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <p>{state.message}</p>
            </div>
          ) : (
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-[var(--muted-foreground)]" />
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
                  <p className="text-sm text-[var(--destructive)]">
                    {state.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Sending link…" : "Send sign-in link"}
              </Button>
            </form>
          )}

          <p className="text-center text-xs text-[var(--muted-foreground)]">
            No account? Ask an admin to invite you — there is no public signup.
          </p>
        </div>
      </div>
    </main>
  );
}
