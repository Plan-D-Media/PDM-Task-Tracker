"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

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
