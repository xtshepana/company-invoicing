import "server-only";

import { getResendClient } from "@/lib/email/resend-client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import type { EmailContent } from "@/lib/email/templates";
import { resolveCc } from "@/lib/email/cc";

export interface SendEmailParams extends EmailContent {
  to: string;
  emailType: string;
  entity: string;
  entityId?: string;
  attachment?: { filename: string; content: Buffer };
  /** Optional copy (CC) for the accounts mailbox - dropped if it is the same address as `to`. */
  cc?: string | null;
  /** Shown as the sender's display name (e.g. the company name) instead of whatever's baked into EMAIL_FROM. */
  fromName?: string;
}

/** Keeps EMAIL_FROM's address but swaps in a per-send display name, e.g. "Acme Ltd <invoices@acme.com>". */
function buildFromHeader(emailFrom: string, fromName?: string): string {
  if (!fromName) return emailFrom;
  const address = emailFrom.match(/<([^>]+)>/)?.[1] ?? emailFrom.trim();
  return `${fromName} <${address}>`;
}

export interface SendEmailResult {
  status: "sent" | "failed" | "skipped";
  error?: string;
}

/**
 * Sends one transactional email and always records the attempt in
 * email_logs (via the service-role client — there is no insert policy for
 * the authenticated role on that table, matching the audit_logs pattern).
 * Never throws: a failed or skipped send should not fail the caller's
 * larger operation (e.g. generating a recurring invoice must succeed even
 * if the email bounces or Resend isn't configured). The outcome is also
 * returned so callers that need it (e.g. counting a notice's deliveries)
 * don't have to re-read the log; everyone else can ignore it.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const admin = createAdminSupabaseClient();
  const resend = getResendClient();

  if (!resend || !params.to) {
    const error = !resend ? "RESEND_API_KEY is not configured." : "Customer has no email address on file.";
    await admin.from("email_logs").insert({
      email_type: params.emailType,
      recipient: params.to || "(no email on file)",
      subject: params.subject,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      status: "skipped",
      error,
    });
    return { status: "skipped", error };
  }

  const env = getServerEnv();

  try {
    const { error } = await resend.emails.send({
      from: buildFromHeader(env.EMAIL_FROM, params.fromName),
      to: params.to,
      cc: resolveCc(params.to, params.cc),
      subject: params.subject,
      html: params.html,
      attachments: params.attachment
        ? [{ filename: params.attachment.filename, content: params.attachment.content }]
        : undefined,
    });

    if (error) {
      await admin.from("email_logs").insert({
        email_type: params.emailType,
        recipient: params.to,
        subject: params.subject,
        entity: params.entity,
        entity_id: params.entityId ?? null,
        status: "failed",
        error: error.message,
      });
      return { status: "failed", error: error.message };
    }

    await admin.from("email_logs").insert({
      email_type: params.emailType,
      recipient: params.to,
      subject: params.subject,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      status: "sent",
    });
    return { status: "sent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    await admin.from("email_logs").insert({
      email_type: params.emailType,
      recipient: params.to,
      subject: params.subject,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      status: "failed",
      error: message,
    });
    return { status: "failed", error: message };
  }
}
