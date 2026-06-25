"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { DEV_LOGIN_ENABLED } from "@/lib/dev";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

export type LoginState = { ok: boolean; message: string };

/**
 * Send a magic-link to an ALREADY-INVITED agency user.
 *
 * Three gates enforce "members-only / invite-only" (Brief §2.1):
 *  1. Domain check here (fast feedback).
 *  2. `shouldCreateUser: false` — OTP never creates a new user, so only
 *     pre-invited accounts can log in.
 *  3. The DB trigger `enforce_email_domain` (defence in depth).
 */
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const email = parsed.data;

  const domain = email.split("@")[1];
  if (domain !== publicEnv.allowedEmailDomain) {
    return {
      ok: false,
      message: `Only @${publicEnv.allowedEmailDomain} accounts can sign in.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm`,
    },
  });

  if (error) {
    // Don't leak whether the address exists; uniform message.
    return {
      ok: true,
      message:
        "If that account exists, a sign-in link is on its way. Check your inbox.",
    };
  }

  return {
    ok: true,
    message: "Check your inbox for a sign-in link.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * DEV-ONLY email + password sign-in (Brief: dev convenience; magic-link is
 * the real path). Uses `signInWithPassword`, which writes the SAME session
 * cookies as the magic-link `verifyOtp` flow, then redirects to the
 * dashboard — so the landed session is identical either way.
 *
 * Hard-gated by `DEV_LOGIN_ENABLED`: even if the UI is somehow rendered or
 * the action is called directly, it refuses unless dev login is enabled.
 */
export async function devSignIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!DEV_LOGIN_ENABLED) {
    return { ok: false, message: "Dev login is disabled." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, message: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, message: error.message };
  }

  // Same destination as the magic-link flow (auth/confirm → `/`).
  redirect("/");
}
