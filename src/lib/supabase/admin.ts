import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * SERVICE-ROLE Supabase client. BYPASSES RLS.
 *
 * The `server-only` import above causes a build-time error if this module
 * is ever pulled into a client bundle (House Rule §11). Use this client
 * ONLY in trusted server contexts that legitimately need to act across
 * users: the deadline-alarm scanner, the seed script, and admin-invite
 * actions. Never hand its results to a user unfiltered.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.supabaseUrl,
    serverEnv.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
