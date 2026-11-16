import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env.server";

/**
 * User-scoped database access. **This is the default path for all user-facing
 * reads and writes** (docs/PLAN.md §4).
 *
 * Every statement runs as the `authenticated` role carrying the user's JWT, so
 * `auth.uid()` is the real user and RLS applies in full. There is no way to
 * widen access from here, which is the point.
 */
export async function createUserClient() {
  const env = publicEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled by middleware instead.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user, or null.
 *
 * Always uses `getUser()`, which verifies the JWT with the auth server.
 * Never trust `getSession()` on the server — its contents come from the cookie
 * and are not revalidated.
 */
export async function getCurrentUser() {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The signed-in user, or throw. For routes a guard has already protected. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
