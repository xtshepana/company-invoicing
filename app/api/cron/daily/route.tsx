import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getServerEnv } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { computeDocumentTotals } from "@/lib/documents";
import { recordAuditLog } from "@/server/services/audit";
import { sendEmail } from "@/server/services/email";
import { recurringInvoiceGeneratedEmail, paymentReminderEmail } from "@/lib/email/templates";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";
import { REMINDER_OFFSET_DAYS } from "@/lib/config/defaults";
import type { LineItemInput } from "@/lib/validations/line-items";
import type { CompanySettings } from "@/lib/config/system-settings";
import type { InvoiceWithItems } from "@/server/services/invoices";
import type { Json } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerationResult {
  recurringInvoiceId: string;
  status: "generated" | "already_generated" | "error";
  invoiceId?: string;
  error?: string;
}

interface ReminderResult {
  invoiceId: string;
  offsetDays: number;
  status: "sent" | "error";
  error?: string;
}

/**
 * Hostinger (or any scheduler) should call this once a day with:
 *   Authorization: Bearer <CRON_SECRET>
 * Every step here is idempotent — running this twice on the same day must
 * never double-generate an invoice or double-send a reminder (see
 * generate_recurring_invoice's own idempotency check, and the
 * invoice_reminders_sent unique constraint here).
 */
export async function GET(request: Request) {
  const env = getServerEnv();
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: settings } = await admin.from("company_settings").select("*").eq("id", true).single();
  if (!settings) {
    return NextResponse.json({ error: "Company settings not found." }, { status: 500 });
  }

  const generationResults = await generateDueRecurringInvoices(admin, settings, today);
  const reminderResults = settings.payment_reminders_enabled
    ? await sendDueReminders(admin, settings, today)
    : [];

  return NextResponse.json({
    date: today,
    recurringInvoices: {
      processed: generationResults.length,
      generated: generationResults.filter((r) => r.status === "generated").length,
      alreadyGenerated: generationResults.filter((r) => r.status === "already_generated").length,
      errors: generationResults.filter((r) => r.status === "error"),
    },
    reminders: {
      sent: reminderResults.filter((r) => r.status === "sent").length,
      errors: reminderResults.filter((r) => r.status === "error"),
    },
  });
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

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

  const results: GenerationResult[] = [];

  for (const recurring of due ?? []) {
    try {
      const lineItems: LineItemInput[] = recurring.recurring_invoice_items.map((item) => ({
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        vat_rate: item.vat_rate,
      }));

      const customer = recurring.customers as { payment_terms_days: number | null; email: string; company_name: string } | null;
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
        results.push({ recurringInvoiceId: recurring.id, status: "already_generated", invoiceId: existingInvoice.id });
        continue;
      }

      const { lines, totals } = computeDocumentTotals(lineItems, recurring.prices_include_vat);
      const termsDays = recurring.payment_terms_days ?? customer?.payment_terms_days ?? settings.default_payment_terms_days;
      const dueDate = addDays(invoiceDate, termsDays);

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
        results.push({ recurringInvoiceId: recurring.id, status: "error", error: error?.message ?? "Unknown error." });
        continue;
      }

      await recordAuditLog({
        userId: null,
        action: "recurring_invoice.generated",
        entity: "invoices",
        entityId: invoiceId,
        newValue: { recurring_invoice_id: recurring.id, invoice_date: invoiceDate },
      });

      if (recurring.auto_send_email && customer?.email) {
        await emailGeneratedInvoice(admin, settings, invoiceId, customer.email, customer.company_name);
      }

      results.push({ recurringInvoiceId: recurring.id, status: "generated", invoiceId });
    } catch (err) {
      results.push({
        recurringInvoiceId: recurring.id,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }

  return results;
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
  });
}

async function sendDueReminders(admin: AdminClient, settings: CompanySettings, today: string): Promise<ReminderResult[]> {
  const { data: candidates } = await admin
    .from("invoices")
    .select("id, invoice_number, due_date, balance_due, status, customers(email, company_name)")
    .gt("balance_due", 0)
    .not("status", "in", "(cancelled,void)");

  const results: ReminderResult[] = [];

  for (const invoice of candidates ?? []) {
    const offsetDays = dateDiffInDays(invoice.due_date, today);
    if (!REMINDER_OFFSET_DAYS.includes(offsetDays as (typeof REMINDER_OFFSET_DAYS)[number])) continue;

    const customer = invoice.customers as { email: string; company_name: string } | null;
    if (!customer?.email) continue;

    const { error: insertError } = await admin
      .from("invoice_reminders_sent")
      .insert({ invoice_id: invoice.id, offset_days: offsetDays });
    if (insertError) {
      // Unique violation means this exact reminder already went out — skip silently, not an error.
      continue;
    }

    try {
      const content = paymentReminderEmail({
        companyName: settings.company_name,
        customerName: customer.company_name,
        invoiceNumber: invoice.invoice_number,
        balanceDue: invoice.balance_due ?? 0,
        dueDate: invoice.due_date,
        currency: settings.default_currency,
        offsetDays,
      });

      await sendEmail({
        to: customer.email,
        ...content,
        emailType: "payment_reminder",
        entity: "invoices",
        entityId: invoice.id,
      });

      await recordAuditLog({
        userId: null,
        action: "invoice.reminder_sent",
        entity: "invoices",
        entityId: invoice.id,
        newValue: { offset_days: offsetDays },
      });

      results.push({ invoiceId: invoice.id, offsetDays, status: "sent" });
    } catch (err) {
      results.push({
        invoiceId: invoice.id,
        offsetDays,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }

  return results;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Days from `fromStr` to `toStr` (positive when `toStr` is later). */
function dateDiffInDays(fromStr: string, toStr: string): number {
  const from = new Date(`${fromStr}T00:00:00Z`).getTime();
  const to = new Date(`${toStr}T00:00:00Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}
