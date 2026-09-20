import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerEnv } from "@/lib/env";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely.
 *
 * Only use this from `server/services/*` for operations that have already
 * independently verified the caller's identity and authorization (see
 * `server/services/auth.ts`). Never construct this client in a route
 * handler or server action directly — go through a service function.
 */
export function createAdminSupabaseClient() {
  const env = getServerEnv();
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
