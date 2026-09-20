import "server-only";

import { getResendClient } from "@/lib/email/resend-client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import type { EmailContent } from "@/lib/email/templates";

export interface SendEmailParams extends EmailContent {
  to: string;
  emailType: string;
  entity: string;
  entityId?: string;
  attachment?: { filename: string; content: Buffer };
}

/**
 * Sends one transactional email and always records the attempt in
 * email_logs (via the service-role client — there is no insert policy for
 * the authenticated role on that table, matching the audit_logs pattern).
 * Never throws: a failed or skipped send should not fail the caller's
 * larger operation (e.g. generating a recurring invoice must succeed even
 * if the email bounces or Resend isn't configured).
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const admin = createAdminSupabaseClient();
  const resend = getResendClient();

  if (!resend || !params.to) {
    await admin.from("email_logs").insert({
      email_type: params.emailType,
      recipient: params.to || "(no email on file)",
      subject: params.subject,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      status: "skipped",
      error: !resend ? "RESEND_API_KEY is not configured." : "Customer has no email address on file.",
    });
    return;
  }

  const env = getServerEnv();

  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
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
      return;
    }

    await admin.from("email_logs").insert({
      email_type: params.emailType,
      recipient: params.to,
      subject: params.subject,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      status: "sent",
    });
  } catch (err) {
    await admin.from("email_logs").insert({
      email_type: params.emailType,
      recipient: params.to,
      subject: params.subject,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error.",
    });
  }
}
