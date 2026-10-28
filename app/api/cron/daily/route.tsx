import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getServerEnv } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { computeDocumentTotals } from "@/lib/documents";
import { mapWithConcurrency } from "@/lib/concurrency";
import { recordAuditLog } from "@/server/services/audit";
import { sendEmail } from "@/server/services/email";
import { recurringInvoiceGeneratedEmail } from "@/lib/email/templates";
import { emailSignatureFromSettings } from "@/lib/email/signature";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";
import { runPaymentReminders } from "@/server/services/payment-reminders";
import { todayInSouthAfrica } from "@/lib/reminder-schedule";
import { dueDateForRecurring } from "@/lib/billing-schedule";
import type { LineItemInput } from "@/lib/validations/line-items";
import type { CompanySettings } from "@/lib/config/system-settings";
import type { InvoiceWithItems } from "@/server/services/invoices";
import type { Json } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

// Postgres writes (existence check, RPC, audit log) have no external rate
// limit and each recurring invoice / reminder is independent — safe to run
// several at once, capped only to avoid opening an unreasonable number of
// simultaneous connections if this ever runs against a very large batch.
const GENERATION_CONCURRENCY = 10;
// Resend's rate limit is a shared, external constraint (documented as 2
// requests/second on standard plans) — this stays low and separate from
// GENERATION_CONCURRENCY regardless of how that one is tuned.
const EMAIL_CONCURRENCY = 2;

interface GenerationResult {
  recurringInvoiceId: string;
  status: "generated" | "already_generated" | "error";
  invoiceId?: string;
  error?: string;
}

/**
 * Hostinger (or any scheduler) should call this once a day with:
 *   Authorization: Bearer <CRON_SECRET>
 * Every step here is idempotent — running this twice on the same day must
 * never double-generate an invoice or double-send a reminder (see
 * generate_recurring_invoice's own idempotency check, and the
 * payment_checkpoints_sent unique constraint here).
 */
export async function GET(request: Request) {
  const env = getServerEnv();
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  // The business runs on South African time: the UTC date is still "yesterday" for the first two hours of the day, which
  // would send a month-end reminder, or generate an invoice, on the wrong day.
  const today = todayInSouthAfrica();

  const { data: settings } = await admin.from("company_settings").select("*").eq("id", true).single();
  if (!settings) {
    return NextResponse.json({ error: "Company settings not found." }, { status: 500 });
  }

  const generationResults = await generateDueRecurringInvoices(admin, settings, today);
  const reminders = settings.payment_reminders_enabled ? await runPaymentReminders(admin, settings, today) : null;

  return NextResponse.json({
    date: today,
    recurringInvoices: {
      processed: generationResults.length,
      generated: generationResults.filter((r) => r.status === "generated").length,
      alreadyGenerated: generationResults.filter((r) => r.status === "already_generated").length,
      errors: generationResults.filter((r) => r.status === "error"),
    },
    reminders: reminders ?? { enabled: false },
  });
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

interface PendingEmail {
  invoiceId: string;
  customerEmail: string;
  customerName: string;
}

interface GenerationOutcome extends GenerationResult {
  pendingEmail?: PendingEmail;
}

/**
 * Two phases, not one sequential loop: generating each invoice (an
 * existence check, an RPC call, an audit log write) has no external rate
 * limit and every recurring invoice is independent of every other, so
 * those run with bounded concurrency. Sending the "invoice generated"
 * email (a PDF render plus a Resend call) is the part that's actually
 * expensive and shares an external rate limit, so it's a separate,
 * more tightly bounded pass over just the ones that need it — this is
 * what keeps a day with many due recurring invoices from serializing
 * PDF-render-plus-email-send N times inside the 60s budget.
 */
async function generateDueRecurringInvoices(
  admin: AdminClient,
  settings: CompanySettings,
  today: string
): Promise<GenerationResult[]> {
  const { data: due } = await admin
    .from("recurring_invoices")
    .select("*, recurring_invoice_items(*), customers(payment_terms_days, email, company_name)")
    .eq("status", "active")
    .eq("auto_generate", true)
    .lte("next_invoice_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`);

  const outcomes = await mapWithConcurrency(due ?? [], GENERATION_CONCURRENCY, (recurring) =>
    generateOneRecurringInvoice(admin, settings, recurring)
  );

  const pendingEmails = outcomes.flatMap((o) => (o.pendingEmail ? [o.pendingEmail] : []));
  await mapWithConcurrency(pendingEmails, EMAIL_CONCURRENCY, (pending) =>
    emailGeneratedInvoice(admin, settings, pending.invoiceId, pending.customerEmail, pending.customerName)
  );

  return outcomes.map((o) => ({ recurringInvoiceId: o.recurringInvoiceId, status: o.status, invoiceId: o.invoiceId, error: o.error }));
}

interface DueRecurringInvoice {
  id: string;
  next_invoice_date: string;
  prices_include_vat: boolean;
  payment_terms_days: number | null;
  auto_send_email: boolean;
  recurring_invoice_items: {
    product_id: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    vat_rate: number;
  }[];
  customers: { payment_terms_days: number | null; email: string; company_name: string } | null;
}

async function generateOneRecurringInvoice(
  admin: AdminClient,
  settings: CompanySettings,
  recurring: DueRecurringInvoice
): Promise<GenerationOutcome> {
  try {
    const lineItems: LineItemInput[] = recurring.recurring_invoice_items.map((item) => ({
      product_id: item.product_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
      vat_rate: item.vat_rate,
    }));

    const customer = recurring.customers;
    const invoiceDate = recurring.next_invoice_date;

    // Check the exact same (recurring_invoice_id, invoice_date) pair the
    // RPC itself checks, so we know definitively whether this run is a
    // no-op re-run rather than guessing from last_generated_date (which
    // can't distinguish "already generated this cycle" from "an invoice
    // for this date already exists for some other reason").
    const { data: existingInvoice } = await admin
      .from("invoices")
      .select("id")
      .eq("recurring_invoice_id", recurring.id)
      .eq("invoice_date", invoiceDate)
      .maybeSingle();

    if (existingInvoice) {
      return { recurringInvoiceId: recurring.id, status: "already_generated", invoiceId: existingInvoice.id };
    }

    const { lines, totals } = computeDocumentTotals(lineItems, recurring.prices_include_vat, settings.vat_registered);
    const dueDate = dueDateForRecurring({
      invoiceDate,
      recurringTermsDays: recurring.payment_terms_days,
      customerTermsDays: customer?.payment_terms_days ?? null,
      defaultTermsDays: settings.default_payment_terms_days,
      dueAtMonthEnd: settings.recurring_due_at_month_end,
    });

    const { data: invoiceId, error } = await admin.rpc("generate_recurring_invoice", {
      p_recurring_invoice_id: recurring.id,
      p_invoice_date: invoiceDate,
      p_due_date: dueDate,
      p_subtotal: Number(totals.subtotal),
      p_discount_total: Number(totals.discount_total),
      p_vat_total: Number(totals.vat_total),
      p_total: Number(totals.total),
      p_line_items: lines as unknown as Json,
    });

    if (error || !invoiceId) {
      return { recurringInvoiceId: recurring.id, status: "error", error: error?.message ?? "Unknown error." };
    }

    await recordAuditLog({
      userId: null,
      action: "recurring_invoice.generated",
      entity: "invoices",
      entityId: invoiceId,
      newValue: { recurring_invoice_id: recurring.id, invoice_date: invoiceDate },
    });

    const outcome: GenerationOutcome = { recurringInvoiceId: recurring.id, status: "generated", invoiceId };
    if (recurring.auto_send_email && customer?.email) {
      outcome.pendingEmail = { invoiceId, customerEmail: customer.email, customerName: customer.company_name };
    }
    return outcome;
  } catch (err) {
    return {
      recurringInvoiceId: recurring.id,
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

async function emailGeneratedInvoice(
  admin: AdminClient,
  settings: CompanySettings,
  invoiceId: string,
  customerEmail: string,
  customerName: string
) {
  const { data: invoice } = await admin
    .from("invoices")
    .select("*, customers(*), invoice_items(*)")
    .eq("id", invoiceId)
    .single();
  if (!invoice) return;

  const pdfBuffer = await renderToBuffer(<InvoicePdf invoice={invoice as unknown as InvoiceWithItems} settings={settings} />);
  const content = recurringInvoiceGeneratedEmail({
    companyName: settings.company_name,
    signature: emailSignatureFromSettings(settings),
    customerName,
    invoiceNumber: invoice.invoice_number,
    total: invoice.total,
    dueDate: invoice.due_date,
    currency: settings.default_currency,
  });

  await sendEmail({
    to: customerEmail,
    ...content,
    emailType: "recurring_invoice_generated",
    entity: "invoices",
    entityId: invoiceId,
    attachment: { filename: `${invoice.invoice_number}.pdf`, content: Buffer.from(pdfBuffer) },
    cc: settings.accounts_notification_email,
    fromName: settings.company_name,
  });
}
