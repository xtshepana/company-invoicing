"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireModuleAccess } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { invoiceSchema } from "@/lib/validations/invoices";
import { computeDocumentTotals } from "@/lib/documents";
import { getCompanySettings } from "@/lib/config/system-settings";
import { sendEmail } from "@/server/services/email";
import { invoiceSentEmail } from "@/lib/email/templates";
import { renderInvoicePdf } from "@/lib/pdf/render-invoice";
import type { InvoiceWithItems } from "@/server/services/invoices";
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

export async function createInvoiceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("invoices");

  const parsed = invoiceSchema.safeParse(parseFormData(formData));
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

  const { data: invoiceId, error } = await supabase.rpc("create_invoice", {
    p_customer_id: parsed.data.customer_id,
    p_invoice_date: parsed.data.invoice_date,
    p_due_date: parsed.data.due_date,
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

  if (error || !invoiceId) {
    return { error: "Unable to save this invoice. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "invoice.created",
    entity: "invoices",
    entityId: invoiceId,
    newValue: { ...parsed.data, ...totals } as unknown as Json,
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

export async function updateInvoiceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("invoices");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing invoice." };

  const parsed = invoiceSchema.safeParse(parseFormData(formData));
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

  const { error } = await supabase.rpc("update_invoice", {
    p_invoice_id: id,
    p_customer_id: parsed.data.customer_id,
    p_invoice_date: parsed.data.invoice_date,
    p_due_date: parsed.data.due_date,
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
    return {
      error: error.message.includes("finalized") ? error.message : "Unable to save this invoice. Please try again.",
    };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "invoice.updated",
    entity: "invoices",
    entityId: id,
    newValue: { ...parsed.data, ...totals } as unknown as Json,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

export async function markInvoiceSentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("invoices");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing invoice." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("invoices").update({ status: "sent" }).eq("id", id).eq("status", "draft");
  if (error) return { error: "Unable to update this invoice. Please try again." };

  await recordAuditLog({ userId: actor.id, action: "invoice.marked_sent", entity: "invoices", entityId: id });
  await sendInvoiceSentEmail(id);
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

/**
 * Uses the service-role client (not the caller's RLS-scoped session) so the
 * email always reaches the customer regardless of whether the staff member
 * marking the invoice sent also happens to have the customers module
 * enabled — matches how server/services/email.ts and audit.ts already read
 * data purely to build a system-generated record, not to expose it back to
 * the caller's response.
 */
async function sendInvoiceSentEmail(invoiceId: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("*, customers(*), invoice_items(*)")
    .eq("id", invoiceId)
    .single();
  if (!invoice?.customers?.email) return;

  const settings = await getCompanySettings();
  const pdfBuffer = await renderInvoicePdf(invoice as unknown as InvoiceWithItems, settings);
  const content = invoiceSentEmail({
    companyName: settings.company_name,
    customerName: invoice.customers.company_name,
    invoiceNumber: invoice.invoice_number,
    total: invoice.total,
    balanceDue: invoice.balance_due ?? 0,
    dueDate: invoice.due_date,
    currency: settings.default_currency,
  });

  await sendEmail({
    to: invoice.customers.email,
    ...content,
    emailType: "invoice_sent",
    entity: "invoices",
    entityId: invoiceId,
    attachment: { filename: `${invoice.invoice_number}.pdf`, content: pdfBuffer },
  });
}

export async function voidInvoiceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("invoices");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing invoice." };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("invoices").select("amount_paid, status").eq("id", id).single();
  if (existing && existing.amount_paid > 0) {
    return { error: "This invoice has payments allocated to it and cannot be voided. Issue a credit note instead." };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "void", voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Unable to void this invoice. Please try again." };

  await recordAuditLog({ userId: actor.id, action: "invoice.voided", entity: "invoices", entityId: id });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

export async function cancelInvoiceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("invoices");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing invoice." };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("invoices").select("amount_paid").eq("id", id).single();
  if (existing && existing.amount_paid > 0) {
    return { error: "This invoice has payments allocated to it and cannot be cancelled. Issue a credit note instead." };
  }

  const { error } = await supabase.from("invoices").update({ status: "cancelled" }).eq("id", id);
  if (error) return { error: "Unable to cancel this invoice. Please try again." };

  await recordAuditLog({ userId: actor.id, action: "invoice.cancelled", entity: "invoices", entityId: id });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}
