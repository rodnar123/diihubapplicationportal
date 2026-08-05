import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env";

/**
 * Browser-side Supabase client. Only ever holds the anon key, so everything it
 * can do is bounded by Row Level Security and by our own server-side checks.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
