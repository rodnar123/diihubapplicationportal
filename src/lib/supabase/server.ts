import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env.server";

/**
 * Supabase is used for **Storage only** — authentication is handled by
 * NextAuth + Google.
 *
 * This client holds the service-role key, so it bypasses Row Level Security
 * entirely. It must never be reachable from a request path that has not
 * already been authorised; every caller in `services/storage` checks
 * ownership or reviewer role first.
 *
 * There is deliberately no browser-side Supabase client: the bucket is
 * private, and files are reached only through `/api/attachments/[id]`, which
 * authorises the caller and then mints a short-lived signed URL.
 */
export function createSupabaseAdminClient() {
  return createClient(
    serverEnv.SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
