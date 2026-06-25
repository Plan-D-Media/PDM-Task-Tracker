import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Browser Supabase client. Uses the ANON key and therefore is fully
 * governed by Row Level Security — this is the only Supabase client that
 * ever runs in the user's browser.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
  );
}
