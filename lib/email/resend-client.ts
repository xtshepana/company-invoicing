import "server-only";

import { Resend } from "resend";

let cachedClient: Resend | null = null;

/** Returns null (not a client) when RESEND_API_KEY isn't configured — callers must handle that as "email sending is disabled", not an error. */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }
  return cachedClient;
}
