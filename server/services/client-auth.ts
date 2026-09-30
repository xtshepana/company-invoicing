import "server-only";

import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { getCompanySettings } from "@/lib/config/system-settings";
import { sendEmail } from "@/server/services/email";
import { clientMagicLinkEmail } from "@/lib/email/templates";

const SESSION_COOKIE = "client_session";
const MAGIC_LINK_TTL_MINUTES = 15;
const MAGIC_LINK_RESEND_COOLDOWN_SECONDS = 60;
const SESSION_TTL_DAYS = 30;

export class UnauthenticatedClientError extends Error {
  constructor() {
    super("You must be signed in to view this.");
    this.name = "UnauthenticatedClientError";
  }
}

export class ForbiddenClientError extends Error {
  constructor() {
    super("You do not have access to that.");
    this.name = "ForbiddenClientError";
  }
}

export interface ClientSession {
  customerIds: string[];
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Escapes % and _ (ILIKE wildcards) so an email lookup can never turn into a pattern match. */
function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

/**
 * Starts a client-portal login: finds every active customer matching this
 * email (case-insensitively - customers.email has no uniqueness
 * constraint and staff enter it with whatever casing), and if any match,
 * emails one magic link scoped to all of them.
 *
 * Always resolves the same way regardless of whether anything matched or
 * a cooldown is active, so the caller (a Server Action) can show the same
 * "check your email" message either way - this can't be used to find out
 * which addresses have an account.
 */
export async function requestClientMagicLink(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const admin = createAdminSupabaseClient();

  const cooldownSince = new Date(Date.now() - MAGIC_LINK_RESEND_COOLDOWN_SECONDS * 1000).toISOString();
  const { data: recent } = await admin
    .from("client_magic_links")
    .select("id")
    .eq("email", normalizedEmail)
    .gt("created_at", cooldownSince)
    .limit(1)
    .maybeSingle();
  if (recent) return;

  const { data: customers } = await admin
    .from("customers")
    .select("id")
    .ilike("email", escapeLikePattern(normalizedEmail))
    .eq("is_active", true);
  if (!customers || customers.length === 0) return;

  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60_000).toISOString();

  const { error } = await admin.from("client_magic_links").insert({
    token_hash: hashToken(token),
    email: normalizedEmail,
    customer_ids: customers.map((c) => c.id),
    expires_at: expiresAt,
  });
  if (error) return;

  const settings = await getCompanySettings();
  const env = getServerEnv();
  const content = clientMagicLinkEmail({
    companyName: settings.company_name,
    loginUrl: `${env.APP_URL}/client/verify?token=${token}`,
    expiresInMinutes: MAGIC_LINK_TTL_MINUTES,
  });

  await sendEmail({
    to: normalizedEmail,
    ...content,
    emailType: "client_magic_link",
    entity: "customers",
    fromName: settings.company_name,
  });
}

/**
 * Consumes a magic-link token (single use, atomically - the UPDATE's WHERE
 * clause is what makes a concurrent replay of the same link a no-op rather
 * than a race) and starts a new session, setting the session cookie.
 * Returns null for any invalid/expired/already-used/replayed token,
 * deliberately without distinguishing which.
 */
export async function verifyClientMagicLink(token: string): Promise<ClientSession | null> {
  const admin = createAdminSupabaseClient();

  const { data: link } = await admin
    .from("client_magic_links")
    .update({ consumed_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token))
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("email, customer_ids")
    .maybeSingle();
  if (!link) return null;

  const sessionToken = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60_000);

  const { error } = await admin.from("client_sessions").insert({
    token_hash: hashToken(sessionToken),
    email: link.email,
    customer_ids: link.customer_ids,
    expires_at: expiresAt.toISOString(),
  });
  if (error) return null;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/client",
    expires: expiresAt,
  });

  return { customerIds: link.customer_ids };
}

/**
 * Returns the current client session, or null if there isn't a valid one.
 * Never throws. Wrapped in cache() so a layout and every page/action under
 * it share one cookie-and-DB lookup per request, same pattern as
 * getCurrentProfile() for staff.
 */
export const getClientSession = cache(async (): Promise<ClientSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const admin = createAdminSupabaseClient();
  const { data: session } = await admin
    .from("client_sessions")
    .select("id, customer_ids")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session) return null;

  // Best-effort activity timestamp - not worth failing the request over.
  void admin.from("client_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);

  return { customerIds: session.customer_ids };
});

/** Throws UnauthenticatedClientError if there's no valid session - use from every client-portal page/action. */
export async function requireClientSession(): Promise<ClientSession> {
  const session = await getClientSession();
  if (!session) throw new UnauthenticatedClientError();
  return session;
}

/**
 * The one place that decides whether a session may see a given customer's
 * data. Every client-portal query must call this before returning a row -
 * RLS can't help here, since a customer never gets a Supabase session (see
 * architecture rule 6 in CLAUDE.md).
 */
export function assertOwnsCustomer(session: ClientSession, customerId: string): void {
  if (!session.customerIds.includes(customerId)) {
    throw new ForbiddenClientError();
  }
}

export async function logoutClient(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const admin = createAdminSupabaseClient();
    await admin
      .from("client_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashToken(token));
  }
  cookieStore.delete(SESSION_COOKIE);
}
