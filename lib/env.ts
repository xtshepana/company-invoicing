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
    // NEXT_PUBLIC_* values are inlined into the build output at build time,
    // not read fresh at process start - changing this in the hosting
    // panel and restarting the running process is not enough on its own;
    // it takes an actual rebuild (a new deploy) to pick up a new value.
    APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };

  return cachedServerEnv;
}

export { getPublicEnv } from "@/lib/env-public";
