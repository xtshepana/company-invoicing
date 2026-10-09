import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCompanySettings } from "@/lib/config/system-settings";
import { sendEmail } from "@/server/services/email";
import { recordAuditLog } from "@/server/services/audit";
import { customerNoticeEmail } from "@/lib/email/templates";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  deliverableEmail,
  noticeCompanyFromSettings,
  renderNoticeBodyHtml,
  renderNoticeSubject,
  validateNoticeContent,
  type NoticeCompany,
  type NoticeVars,
} from "@/lib/notices";
import type { Profile } from "@/server/services/auth";
import type { Tables } from "@/types/database";

export type CustomerNotice = Tables<"customer_notices">;

const NOTICE_ENTITY = "customer_notices";
// Resend's rate limit is shared and external (2 requests/second on standard
// plans) - same cap the daily cron uses for its own email batches.
const EMAIL_CONCURRENCY = 2;

export interface NoticeRecipient {
  id: string;
  companyName: string;
  email: string;
  accountNumber: string;
}

export interface NoticeRecipientLists {
  sendable: NoticeRecipient[];
  /** Active customers who can't be emailed, so the page can say who to fix. */
  unreachable: { id: string; companyName: string; reason: string }[];
}

export async function getNoticeCompany(): Promise<NoticeCompany> {
  return noticeCompanyFromSettings(await getCompanySettings());
}

export async function listNoticeRecipients(): Promise<NoticeRecipientLists> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select("id, company_name, email, customer_reference")
    .eq("is_active", true)
    .order("company_name");

  const lists: NoticeRecipientLists = { sendable: [], unreachable: [] };
  for (const customer of data ?? []) {
    const email = deliverableEmail(customer.email);
    if (email) {
      lists.sendable.push({
        id: customer.id,
        companyName: customer.company_name,
        email,
        accountNumber: customer.customer_reference,
      });
    } else {
      lists.unreachable.push({
        id: customer.id,
        companyName: customer.company_name,
        reason: customer.email.trim() ? "Email isn't a single valid address" : "No email address",
      });
    }
  }
  return lists;
}

export async function listNotices(limit = 50): Promise<CustomerNotice[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customer_notices")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getNotice(id: string): Promise<CustomerNotice | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("customer_notices").select("*").eq("id", id).maybeSingle();
  return data;
}

export interface NoticeDelivery {
  id: string;
  recipient: string;
  customerName: string | null;
  status: "sent" | "failed" | "skipped";
  error: string | null;
}

export async function getNoticeDeliveries(noticeId: string): Promise<NoticeDelivery[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: logs }, { data: customers }] = await Promise.all([
    supabase
      .from("email_logs")
      .select("id, recipient, status, error")
      .eq("entity", NOTICE_ENTITY)
      .eq("entity_id", noticeId)
      .eq("email_type", "customer_notice")
      .order("created_at", { ascending: true }),
    supabase.from("customers").select("company_name, email"),
  ]);

  const nameByEmail = new Map<string, string>();
  for (const customer of customers ?? []) {
    const key = customer.email.trim().toLowerCase();
    if (key && !nameByEmail.has(key)) nameByEmail.set(key, customer.company_name);
  }

  return (logs ?? []).map((log) => ({
    id: log.id,
    recipient: log.recipient,
    customerName: nameByEmail.get(log.recipient.trim().toLowerCase()) ?? null,
    status: log.status,
    error: log.error,
  }));
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function varsFor(company: NoticeCompany, customerName: string, accountNumber: string): NoticeVars {
  return { customerName, accountNumber, company };
}

function buildEmail(company: NoticeCompany, subject: string, body: string, vars: NoticeVars) {
  return customerNoticeEmail({
    companyName: company.name,
    customerName: vars.customerName,
    subject: renderNoticeSubject(subject, vars),
    bodyHtml: renderNoticeBodyHtml(body, vars),
  });
}

/** One email to the signed-in admin, with made-up customer details, so they can see exactly what customers will get. */
export async function sendNoticeTest(params: { actor: Profile; subject: string; body: string }): Promise<Result<unknown>> {
  const company = await getNoticeCompany();
  const problem = validateNoticeContent(params.subject, params.body, company);
  if (problem) return { ok: false, error: problem };

  const content = buildEmail(company, params.subject, params.body, varsFor(company, "Sample Customer", "ABC001"));
  const result = await sendEmail({
    to: params.actor.email,
    ...content,
    subject: `[TEST] ${content.subject}`,
    emailType: "customer_notice_test",
    entity: NOTICE_ENTITY,
    fromName: company.name,
  });
  if (result.status !== "sent") {
    return { ok: false, error: `The test email couldn't be sent: ${result.error ?? "unknown error"}.` };
  }
  return { ok: true };
}

export async function sendNotice(params: {
  actor: Profile;
  subject: string;
  body: string;
  customerIds: string[];
  sendToken: string;
}): Promise<Result<{ id: string }>> {
  const company = await getNoticeCompany();
  const problem = validateNoticeContent(params.subject, params.body, company);
  if (problem) return { ok: false, error: problem };

  // Recipients come from the database, never from what the browser says
  // their email is, and only active customers with exactly one valid address.
  const supabase = await createSupabaseServerClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name, email, customer_reference")
    .in("id", params.customerIds)
    .eq("is_active", true);
  const recipients = (customers ?? []).flatMap((customer) => {
    const email = deliverableEmail(customer.email);
    return email ? [{ customer, email }] : [];
  });
  if (recipients.length === 0) return { ok: false, error: "None of the selected customers has a valid email address." };

  // The unique send_token is what makes a double-click or resubmitted form
  // create (and so send) only one notice.
  const { data: notice, error: insertError } = await supabase
    .from("customer_notices")
    .insert({
      send_token: params.sendToken,
      subject: params.subject,
      body: params.body,
      recipient_count: recipients.length,
      created_by: params.actor.id,
    })
    .select("id")
    .single();
  if (insertError || !notice) {
    return {
      ok: false,
      error:
        insertError?.code === "23505"
          ? "This notice has already been sent. Start a new notice to send another."
          : "Unable to start sending this notice. Please try again.",
    };
  }

  const results = await mapWithConcurrency(recipients, EMAIL_CONCURRENCY, ({ customer, email }) =>
    sendEmail({
      to: email,
      ...buildEmail(company, params.subject, params.body, varsFor(company, customer.company_name, customer.customer_reference)),
      emailType: "customer_notice",
      entity: NOTICE_ENTITY,
      entityId: notice.id,
      fromName: company.name,
    })
  );

  const sent = results.filter((result) => result.status === "sent").length;
  const failed = results.length - sent;
  await supabase
    .from("customer_notices")
    .update({
      sent_count: sent,
      failed_count: failed,
      status: sent > 0 ? "sent" : "failed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", notice.id);

  await recordAuditLog({
    userId: params.actor.id,
    action: "notice.sent",
    entity: NOTICE_ENTITY,
    entityId: notice.id,
    newValue: { subject: params.subject, recipients: recipients.length, sent, failed },
  });

  return { ok: true, id: notice.id };
}
