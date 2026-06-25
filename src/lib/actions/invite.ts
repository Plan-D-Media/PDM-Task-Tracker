"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import type { Role } from "@/lib/database.types";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["admin", "manager", "member"]),
  department_id: z.string().uuid().nullable(),
});

export type InviteResult = { ok: boolean; message: string };

/**
 * Admin-only invite (Brief §2.1: invite-only, no public signup).
 * Sends a Supabase invite email; the new auth user lands on /auth/confirm.
 * We pre-set the profile's role + department so access control is correct
 * the moment they first log in.
 *
 * Authorization is enforced server-side here AND by RLS — a non-admin
 * cannot escalate by calling this directly.
 */
export async function inviteMember(
  input: z.infer<typeof inviteSchema>,
): Promise<InviteResult> {
  const me = await requireProfile();
  if (me.role !== "admin") {
    return { ok: false, message: "Only admins can invite members." };
  }

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid invite details." };
  }
  const { email, full_name, role, department_id } = parsed.data;

  if (email.split("@")[1] !== publicEnv.allowedEmailDomain) {
    return {
      ok: false,
      message: `Only @${publicEnv.allowedEmailDomain} addresses can be invited.`,
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm`,
    data: { full_name },
  });

  if (error || !data.user) {
    return { ok: false, message: error?.message ?? "Invite failed." };
  }

  // The handle_new_user trigger created a baseline profile; set the real
  // role + department (service role bypasses RLS for this admin action).
  const { error: profErr } = await admin
    .from("profiles")
    .update({ full_name, role: role as Role, department_id, email })
    .eq("id", data.user.id);

  if (profErr) {
    return { ok: false, message: `Invited, but profile update failed: ${profErr.message}` };
  }

  return { ok: true, message: `Invited ${full_name} (${email}).` };
}
