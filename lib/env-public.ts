/**
 * Client-safe environment access (NEXT_PUBLIC_* only). This file has no
 * `server-only` guard on purpose — it is imported from both client and
 * server code. Never add a secret to this file; put it in `lib/env.ts`
 * (`getServerEnv()`) instead.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getPublicEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  };
}
