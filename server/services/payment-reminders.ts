import "server-only";

import type { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { mapWithConcurrency } from "@/lib/concurrency";
import { recordAuditLog } from "@/server/services/audit";
import { sendEmail, type SendEmailResult } from "@/server/services/email";
import {
  accountBlockingListEmail,
  customerPaymentReminderEmail,
  reminderSummaryEmail,
  type BlockingListItem,
  type ReminderInvoiceLine,
  type ReminderSummaryRow,
} from "@/lib/email/templates";
import { emailSignatureFromSettings } from "@/lib/email/signature";
import { bankDetailsFromSettings, bankDetailsLines, deliverableEmail } from "@/lib/notices";
import { periodMonthOf, reminderStageForDate, type ReminderStage } from "@/lib/reminder-schedule";
import type { CompanySettings } from "@/lib/config/system-settings";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// Resend's rate limit is shared and external (2 requests/second) - the same cap the rest of the daily job uses.
const EMAIL_CONCURRENCY = 2;
const DB_CONCURRENCY = 10;

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  due_date: string;
  balance_due: number | null;
  customer_id: string;
  customers: { email: string; company_name: string; customer_reference: string | null } | null;
}

export interface ReminderRunResult {
  /** Which step today is, or null when it is not a reminder day. */
  stage: ReminderStage | null;
  /** Unpaid, issued invoices that are past due today. */
  overdueInvoices: number;
  /** Of those, how many had not yet been handled for this step this month. */
  newlyFlagged: number;
  customersEmailed: number;
  customersNotEmailed: number;
  /** The owner's copy of who was reminded (reminder days) went out. */
  summarySent: boolean;
  /** The owner's single list of unpaid accounts (the 7th) went out. */
  blockingListSent: boolean;
  errors: string[];
}

function emptyResult(stage: ReminderStage | null): ReminderRunResult {
  return { stage, overdueInvoices: 0, newlyFlagged: 0, customersEmailed: 0, customersNotEmailed: 0, summarySent: false, blockingListSent: false, errors: [] };
}

interface CustomerGroup {
  customerId: string;
  customer: OverdueInvoice["customers"];
  invoices: OverdueInvoice[];
}

function groupByCustomer(invoices: OverdueInvoice[]): CustomerGroup[] {
  const groups = new Map<string, CustomerGroup>();
  for (const invoice of invoices) {
    const group = groups.get(invoice.customer_id) ?? { customerId: invoice.customer_id, customer: invoice.customers, invoices: [] };
    group.invoices.push(invoice);
    groups.set(invoice.customer_id, group);
  }
  return [...groups.values()].sort((a, b) => (a.customer?.company_name ?? "").localeCompare(b.customer?.company_name ?? ""));
}

const toLine = (invoice: OverdueInvoice): ReminderInvoiceLine => ({
  invoiceNumber: invoice.invoice_number,
  dueDate: invoice.due_date,
  balanceDue: invoice.balance_due ?? 0,
});

const sumBalances = (invoices: OverdueInvoice[]) => invoices.reduce((sum, invoice) => sum + (invoice.balance_due ?? 0), 0);

/** Records that this step has handled each invoice this month, and returns only the ones newly recorded - a second run the same day finds nothing new. */
async function flagInvoices(admin: AdminClient, invoices: OverdueInvoice[], stage: ReminderStage, periodMonth: string): Promise<OverdueInvoice[]> {
  const flags = await mapWithConcurrency(invoices, DB_CONCURRENCY, async (invoice) => {
    const { error } = await admin.from("payment_checkpoints_sent").insert({ invoice_id: invoice.id, checkpoint: stage, period_month: periodMonth });
    // A unique violation means this step already handled this invoice this month - not newly flagged, and not an error.
    return error ? null : invoice;
  });
  return flags.filter((invoice): invoice is OverdueInvoice => invoice !== null);
}

/** Takes the record back when an email did not go out, so the next run today can try again instead of silently skipping it. */
async function unflag(admin: AdminClient, invoices: OverdueInvoice[], stage: ReminderStage, periodMonth: string): Promise<void> {
  if (invoices.length === 0) return;
  await admin
    .from("payment_checkpoints_sent")
    .delete()
    .in("invoice_id", invoices.map((invoice) => invoice.id))
    .eq("checkpoint", stage)
    .eq("period_month", periodMonth);
}

async function sendSafely(params: Parameters<typeof sendEmail>[0]): Promise<SendEmailResult> {
  try {
    return await sendEmail(params);
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : "Unknown error." };
  }
}

function failureReason(outcome: SendEmailResult): string {
  return outcome.status === "skipped" ? "Email sending isn't set up." : `The email failed: ${outcome.error ?? "unknown error"}.`;
}

/**
 * The daily payment reminder step. On the last day of the month (reminder 1) and on the 5th (the final reminder) every
 * customer with an unpaid, overdue invoice is emailed ONE reminder listing all of theirs, and the owner gets a summary of
 * who was and was not reached. On the 7th the owner gets a single list of every account still unpaid, for blocking.
 * Drafts, cancelled and void invoices are never included (a draft has not been sent to the customer, so reminding them
 * about it would be confusing). Safe to run any number of times in a day: each invoice is handled once per step per month.
 */
export async function runPaymentReminders(admin: AdminClient, settings: CompanySettings, today: string): Promise<ReminderRunResult> {
  const stage = reminderStageForDate(today);
  const result = emptyResult(stage);
  if (!stage) return result;

  const { data } = await admin
    .from("invoices")
    .select("id, invoice_number, due_date, balance_due, customer_id, customers(email, company_name, customer_reference)")
    .gt("balance_due", 0)
    .not("status", "in", "(draft,cancelled,void)")
    .lte("due_date", today)
    .order("due_date", { ascending: true });
  const overdue = (data ?? []) as unknown as OverdueInvoice[];
  result.overdueInvoices = overdue.length;
  if (overdue.length === 0) return result;

  const periodMonth = periodMonthOf(today);
  return stage === "block_list"
    ? sendBlockingList(admin, settings, overdue, periodMonth, result)
    : sendCustomerReminders(admin, settings, stage, overdue, periodMonth, result);
}

async function sendCustomerReminders(
  admin: AdminClient,
  settings: CompanySettings,
  stage: "reminder_1" | "reminder_2",
  overdue: OverdueInvoice[],
  periodMonth: string,
  result: ReminderRunResult
): Promise<ReminderRunResult> {
  const flagged = await flagInvoices(admin, overdue, stage, periodMonth);
  result.newlyFlagged = flagged.length;
  if (flagged.length === 0) return result;

  const signature = emailSignatureFromSettings(settings);
  const bank = bankDetailsFromSettings(settings);
  const bankLines = bank ? bankDetailsLines(bank) : undefined;
  const emailed: ReminderSummaryRow[] = [];
  const notEmailed: ReminderSummaryRow[] = [];

  await mapWithConcurrency(groupByCustomer(flagged), EMAIL_CONCURRENCY, async (group) => {
    const row: ReminderSummaryRow = {
      accountNumber: group.customer?.customer_reference ?? "",
      customerName: group.customer?.company_name ?? "Unknown customer",
      invoiceNumbers: group.invoices.map((invoice) => invoice.invoice_number),
      total: sumBalances(group.invoices),
    };

    const to = deliverableEmail(group.customer?.email);
    if (!to) {
      // Nothing to retry: there is no address to send to. It is listed for the owner to follow up.
      notEmailed.push({ ...row, reason: "The customer has no single valid email address." });
      return;
    }

    const content = customerPaymentReminderEmail({
      companyName: settings.company_name,
      signature,
      customerName: row.customerName,
      accountNumber: row.accountNumber,
      invoices: group.invoices.map(toLine),
      currency: settings.default_currency,
      stage,
      bankLines,
    });
    const outcome = await sendSafely({
      to,
      ...content,
      emailType: `payment_${stage}`,
      entity: "invoices",
      entityId: group.invoices[0].id,
      cc: settings.accounts_notification_email,
      fromName: settings.company_name,
    });

    if (outcome.status === "sent") {
      emailed.push(row);
      await mapWithConcurrency(group.invoices, DB_CONCURRENCY, (invoice) =>
        recordAuditLog({ userId: null, action: "invoice.payment_reminder_emailed", entity: "invoices", entityId: invoice.id, newValue: { stage } })
      );
    } else {
      notEmailed.push({ ...row, reason: failureReason(outcome) });
      result.errors.push(`${row.customerName}: ${failureReason(outcome)}`);
      await unflag(admin, group.invoices, stage, periodMonth);
    }
  });

  result.customersEmailed = emailed.length;
  result.customersNotEmailed = notEmailed.length;

  const owner = deliverableEmail(settings.reminder_review_email);
  if (owner) {
    const summary = reminderSummaryEmail({ companyName: settings.company_name, stage, currency: settings.default_currency, emailed, notEmailed });
    const outcome = await sendSafely({ to: owner, ...summary, emailType: "payment_reminder_summary", entity: "invoices", fromName: settings.company_name });
    result.summarySent = outcome.status === "sent";
    if (!result.summarySent) result.errors.push(`Owner summary: ${failureReason(outcome)}`);
  }
  return result;
}

async function sendBlockingList(
  admin: AdminClient,
  settings: CompanySettings,
  overdue: OverdueInvoice[],
  periodMonth: string,
  result: ReminderRunResult
): Promise<ReminderRunResult> {
  const to = deliverableEmail(settings.reminder_review_email) ?? deliverableEmail(settings.accounts_notification_email);
  if (!to) {
    // Nothing is recorded, so the list still goes out on a later run once an address is set.
    result.errors.push("No reminder review email (or accounts email) is set, so the list of accounts to block was not sent.");
    return result;
  }

  const flagged = await flagInvoices(admin, overdue, "block_list", periodMonth);
  result.newlyFlagged = flagged.length;
  if (flagged.length === 0) return result; // the list already went out this month

  const items: BlockingListItem[] = groupByCustomer(flagged).map((group) => ({
    accountNumber: group.customer?.customer_reference ?? "",
    customerName: group.customer?.company_name ?? "Unknown customer",
    email: group.customer?.email ?? "",
    invoices: group.invoices.map(toLine),
    balance: sumBalances(group.invoices),
    oldestDueDate: group.invoices.map((invoice) => invoice.due_date).sort()[0],
  }));

  const content = accountBlockingListEmail({ companyName: settings.company_name, currency: settings.default_currency, items });
  const outcome = await sendSafely({ to, ...content, emailType: "account_blocking_list", entity: "invoices", fromName: settings.company_name });

  if (outcome.status === "sent") {
    result.blockingListSent = true;
    await mapWithConcurrency(flagged, DB_CONCURRENCY, (invoice) =>
      recordAuditLog({ userId: null, action: "invoice.flagged_for_blocking", entity: "invoices", entityId: invoice.id, newValue: { period_month: periodMonth } })
    );
  } else {
    result.errors.push(`Blocking list: ${failureReason(outcome)}`);
    await unflag(admin, flagged, "block_list", periodMonth);
  }
  return result;
}
