import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Department, Profile } from "@/lib/database.types";

export type ProfileWithDept = Profile & { department: Department | null };

/**
 * Returns the signed-in user's profile (joined with their department) or
 * redirects to /login. Use in every protected Server Component so a
 * missing session can never render app data.
 */
export async function requireProfile(): Promise<ProfileWithDept> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, department:departments(*)")
    .eq("id", user.id)
    .single();

  // Trigger guarantees a profile exists; if a race loses, bounce to login.
  if (!profile) redirect("/login");
  return profile as ProfileWithDept;
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
