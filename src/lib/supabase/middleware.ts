import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/** Routes reachable without a session. */
const PUBLIC_PATHS = ["/login", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the Supabase auth session on every request AND guards routes.
 * Unauthenticated users hitting a protected route are bounced to /login;
 * authenticated users hitting /login are sent to the app.
 *
 * QA §12: "No unauthenticated access to any data route" — enforced here
 * for pages, and again by RLS for the data itself.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with Supabase Auth; do not
  // replace with getSession() which trusts the cookie blindly.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Redirect while PRESERVING any auth cookies `setAll` wrote onto `response`
  // (e.g. a rotated token after a refresh). A bare NextResponse.redirect()
  // drops them, so the next request re-sends the stale cookie → the session
  // is never persisted → infinite redirect loop. This is the canonical
  // @supabase/ssr middleware footgun.
  const redirectTo = (pathnameTarget: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = pathnameTarget;
    url.search = "";
    if (keepNext) url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && !isPublic(pathname)) return redirectTo("/login", true);
  if (user && pathname === "/login") return redirectTo("/");

  return response;
}
