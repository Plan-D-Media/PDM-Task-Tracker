import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Server Supabase client (Server Components, Route Handlers, Server
 * Actions). Still uses the ANON key + the logged-in user's session
 * cookies, so RLS applies exactly as it does in the browser. It does NOT
 * use the service role — privilege escalation lives only in admin.ts.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component. Safe to ignore
            // when middleware is refreshing the session (it is, below).
          }
        },
      },
    },
  );
}
