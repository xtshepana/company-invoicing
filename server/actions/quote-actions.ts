"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireModuleAccess } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { quoteSchema, QUOTE_STATUSES } from "@/lib/validations/quotes";
import { computeDocumentTotals } from "@/lib/documents";
import { getCompanySettings } from "@/lib/config/system-settings";
import { sendEmail } from "@/server/services/email";
import { quoteSentEmail } from "@/lib/email/templates";
import { renderQuotePdf } from "@/lib/pdf/render-quote";
import type { QuoteWithItems } from "@/server/services/quotes";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Json } from "@/types/database";

function parseFormData(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "line_items") continue;
    if (key === "prices_include_vat") {
      obj[key] = value === "on" || value === "true";
      continue;
    }
    obj[key] = value;
  }
  if (!("prices_include_vat" in obj)) obj.prices_include_vat = false;
  const rawLineItems = formData.get("line_items");
  try {
    obj.line_items = typeof rawLineItems === "string" ? JSON.parse(rawLineItems) : [];
  } catch {
    obj.line_items = [];
  }
  return obj;
}

export async function createQuoteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("quotes");

  const parsed = quoteSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const settings = await getCompanySettings();
  const { lines, totals } = computeDocumentTotals(
    parsed.data.line_items,
    parsed.data.prices_include_vat,
    settings.vat_registered
  );
  const supabase = await createSupabaseServerClient();

  const { data: quoteId, error } = await supabase.rpc("create_quote", {
    p_customer_id: parsed.data.customer_id,
    p_quote_date: parsed.data.quote_date,
    p_expiry_date: parsed.data.expiry_date || null,
    p_reference: parsed.data.reference,
    p_prices_include_vat: parsed.data.prices_include_vat,
    p_notes: parsed.data.notes,
    p_terms: parsed.data.terms,
    p_subtotal: Number(totals.subtotal),
    p_discount_total: Number(totals.discount_total),
    p_vat_total: Number(totals.vat_total),
    p_total: Number(totals.total),
    p_line_items: lines as unknown as Json,
  });

  if (error || !quoteId) {
    return { error: "Unable to save this quote. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "quote.created",
    entity: "quotes",
    entityId: quoteId,
    newValue: { ...parsed.data, ...totals } as unknown as Json,
  });

  revalidatePath("/quotes");
  redirect(`/quotes/${quoteId}`);
}

export async function updateQuoteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("quotes");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing quote." };

  const parsed = quoteSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const settings = await getCompanySettings();
  const { lines, totals } = computeDocumentTotals(
    parsed.data.line_items,
    parsed.data.prices_include_vat,
    settings.vat_registered
  );
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("update_quote", {
    p_quote_id: id,
    p_customer_id: parsed.data.customer_id,
    p_quote_date: parsed.data.quote_date,
    p_expiry_date: parsed.data.expiry_date || null,
    p_reference: parsed.data.reference,
    p_prices_include_vat: parsed.data.prices_include_vat,
    p_notes: parsed.data.notes,
    p_terms: parsed.data.terms,
    p_subtotal: Number(totals.subtotal),
    p_discount_total: Number(totals.discount_total),
    p_vat_total: Number(totals.vat_total),
    p_total: Number(totals.total),
    p_line_items: lines as unknown as Json,
  });

  if (error) {
    return { error: error.message.includes("already been converted") ? error.message : "Unable to save this quote. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "quote.updated",
    entity: "quotes",
    entityId: id,
    newValue: { ...parsed.data, ...totals } as unknown as Json,
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  redirect(`/quotes/${id}`);
}

export async function setQuoteStatusAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("quotes");

  const id = formData.get("id");
  const statusInput = formData.get("status");
  if (typeof id !== "string" || !id) return { error: "Missing quote." };
  if (typeof statusInput !== "string" || !QUOTE_STATUSES.includes(statusInput as (typeof QUOTE_STATUSES)[number])) {
    return { error: "Invalid status." };
  }
  const status = statusInput as (typeof QUOTE_STATUSES)[number];

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("quotes").select("converted_invoice_id").eq("id", id).single();
  if (existing?.converted_invoice_id) {
    return { error: "This quote has already been converted to an invoice and its status can no longer change." };
  }

  const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
  if (error) return { error: "Unable to update this quote. Please try again." };

  await recordAuditLog({
    userId: actor.id,
    action: "quote.status_changed",
    entity: "quotes",
    entityId: id,
    newValue: { status },
  });

  if (status === "sent") {
    await sendQuoteSentEmail(id);
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: true };
}

/** Uses the service-role client — see the matching comment on sendInvoiceSentEmail in invoice-actions.ts. */
async function sendQuoteSentEmail(quoteId: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data: quote } = await admin
    .from("quotes")
    .select("*, customers(*), quote_items(*)")
    .eq("id", quoteId)
    .single();
  if (!quote?.customers?.email) return;

  const settings = await getCompanySettings();
  const pdfBuffer = await renderQuotePdf(quote as unknown as QuoteWithItems, settings);
  const content = quoteSentEmail({
    companyName: settings.company_name,
    customerName: quote.customers.company_name,
    quoteNumber: quote.quote_number,
    total: quote.total,
    currency: settings.default_currency,
  });

  await sendEmail({
    to: quote.customers.email,
    ...content,
    emailType: "quote_sent",
    entity: "quotes",
    entityId: quoteId,
    attachment: { filename: `${quote.quote_number}.pdf`, content: pdfBuffer },
  });
}

export async function convertQuoteToInvoiceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("invoices");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing quote." };

  const supabase = await createSupabaseServerClient();
  const { data: invoiceId, error } = await supabase.rpc("convert_quote_to_invoice", { p_quote_id: id });

  if (error || !invoiceId) {
    return { error: error?.message.includes("already been converted") ? error.message : "Unable to convert this quote. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "quote.converted_to_invoice",
    entity: "quotes",
    entityId: id,
    newValue: { invoice_id: invoiceId },
  });
  await recordAuditLog({
    userId: actor.id,
    action: "invoice.created_from_quote",
    entity: "invoices",
    entityId: invoiceId,
    newValue: { quote_id: id },
  });

  revalidatePath("/quotes");
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}
