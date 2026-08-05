import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { clientEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session on every request and mirrors any rotated
 * cookies onto the outgoing response.
 *
 * This runs in the Edge runtime, so it deliberately does *not* touch the
 * database. It answers only one question — "is there a valid session?" —
 * and leaves role authorisation to the server components that can query
 * Prisma.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // `getUser()` revalidates the token against Supabase. `getSession()` would
  // trust whatever is in the cookie, which is not safe for an auth decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
