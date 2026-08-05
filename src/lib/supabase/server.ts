import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Request-scoped Supabase client backed by the session cookie.
 *
 * Server Components are not allowed to mutate cookies. Supabase's token
 * refresh tries to do exactly that, so `setAll` swallows the resulting error:
 * the refreshed token is still used for this request, and `middleware.ts`
 * persists it on a route that *is* allowed to write cookies.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
            // Called from a Server Component — middleware handles persistence.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses Row Level Security entirely, so it must never
 * be reachable from a request path that has not already been authorised.
 *
 * Used for: creating signed download URLs, server-side uploads, and deleting
 * orphaned storage objects.
 */
export function createSupabaseAdminClient() {
  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // The service-role client is stateless; it never carries a session.
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
