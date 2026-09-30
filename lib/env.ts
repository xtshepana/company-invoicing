import "server-only";

/**
 * Server-only environment access. Importing this file from a "use client"
 * component fails at build/runtime because of the `server-only` import.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cachedServerEnv: ServerEnv | null = null;

export interface ServerEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  RESEND_API_KEY: string | undefined;
  EMAIL_FROM: string;
  CRON_SECRET: string;
  APP_URL: string;
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  cachedServerEnv = {
    SUPABASE_URL: required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    SUPABASE_SERVICE_ROLE_KEY: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    SUPABASE_ANON_KEY: required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM ?? "no-reply@example.com",
    CRON_SECRET: required("CRON_SECRET", process.env.CRON_SECRET),
    // Deliberately not NEXT_PUBLIC_-prefixed: this is only ever used in
    // server-only code (building links at request time - redirects, the
    // cron self-trigger, magic-link emails), never in the browser. A
    // NEXT_PUBLIC_ var gets inlined into the build output at build time,
    // so changing it in the hosting panel and restarting wouldn't even
    // take effect without a full rebuild.
    //
    // Deliberately not named APP_URL either, even though that's what the
    // exported property here is still called: on Hostinger's Node.js
    // hosting, a custom env var literally named APP_URL was silently
    // overridden by the platform's own internal bind address
    // (0.0.0.0:<port>) no matter what was set in its env var panel -
    // APP_URL/HOST/PORT-shaped names appear to be platform-reserved
    // there. SITE_URL sidesteps that collision.
    APP_URL: process.env.SITE_URL ?? "http://localhost:3000",
  };

  return cachedServerEnv;
}

export { getPublicEnv } from "@/lib/env-public";
