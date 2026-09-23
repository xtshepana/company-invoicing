"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireModuleAccess } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { creditNoteSchema } from "@/lib/validations/credit-notes";
import { computeDocumentTotals } from "@/lib/documents";
import { getCompanySettings } from "@/lib/config/system-settings";
import { sendEmail } from "@/server/services/email";
import { creditNoteIssuedEmail } from "@/lib/email/templates";
import { renderCreditNotePdf } from "@/lib/pdf/render-credit-note";
import type { CreditNoteWithItems } from "@/server/services/credit-notes";
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

export async function createCreditNoteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("invoices");

  const parsed = creditNoteSchema.safeParse(parseFormData(formData));
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

  const { data: creditNoteId, error } = await supabase.rpc("create_credit_note", {
    p_customer_id: parsed.data.customer_id,
    p_invoice_id: parsed.data.invoice_id || null,
    p_credit_note_date: parsed.data.credit_note_date,
    p_reason: parsed.data.reason,
    p_prices_include_vat: parsed.data.prices_include_vat,
    p_notes: parsed.data.notes,
    p_terms: parsed.data.terms,
    p_subtotal: Number(totals.subtotal),
    p_discount_total: Number(totals.discount_total),
    p_vat_total: Number(totals.vat_total),
    p_total: Number(totals.total),
    p_line_items: lines as unknown as Json,
  });

  if (error || !creditNoteId) {
    return { error: "Unable to save this credit note. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "credit_note.created",
    entity: "credit_notes",
    entityId: creditNoteId,
    newValue: { ...parsed.data, ...totals } as unknown as Json,
  });

  revalidatePath("/credit-notes");
  redirect(`/credit-notes/${creditNoteId}`);
}

export async function updateCreditNoteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("invoices");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing credit note." };

  const parsed = creditNoteSchema.safeParse(parseFormData(formData));
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

  const { error } = await supabase.rpc("update_credit_note", {
    p_credit_note_id: id,
    p_customer_id: parsed.data.customer_id,
    p_invoice_id: parsed.data.invoice_id || null,
    p_credit_note_date: parsed.data.credit_note_date,
    p_reason: parsed.data.reason,
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
      error: error.message.includes("already been issued") ? error.message : "Unable to save this credit note. Please try again.",
    };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "credit_note.updated",
    entity: "credit_notes",
    entityId: id,
    newValue: { ...parsed.data, ...totals } as unknown as Json,
  });

  revalidatePath("/credit-notes");
  revalidatePath(`/credit-notes/${id}`);
  redirect(`/credit-notes/${id}`);
}

export async function issueCreditNoteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("invoices");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing credit note." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("issue_credit_note", { p_credit_note_id: id });
  if (error) {
    return {
      error: error.message.includes("already been issued") || error.message.includes("line item")
        ? error.message
        : "Unable to issue this credit note. Please try again.",
    };
  }

  await recordAuditLog({ userId: actor.id, action: "credit_note.issued", entity: "credit_notes", entityId: id });
  await sendCreditNoteIssuedEmail(id);

  revalidatePath("/credit-notes");
  revalidatePath(`/credit-notes/${id}`);
  return { success: true };
}

export async function voidCreditNoteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("invoices");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing credit note." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("void_credit_note", { p_credit_note_id: id });
  if (error) {
    return {
      error: error.message.includes("already been applied") || error.message.includes("already been cancelled")
        ? error.message
        : "Unable to cancel this credit note. Please try again.",
    };
  }

  await recordAuditLog({ userId: actor.id, action: "credit_note.cancelled", entity: "credit_notes", entityId: id });
  revalidatePath("/credit-notes");
  revalidatePath(`/credit-notes/${id}`);
  return { success: true };
}

/** Uses the service-role client — see the matching comment on sendInvoiceSentEmail in invoice-actions.ts. */
async function sendCreditNoteIssuedEmail(creditNoteId: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data: creditNote } = await admin
    .from("credit_notes")
    .select("*, customers(*), invoices(invoice_number), credit_note_items(*)")
    .eq("id", creditNoteId)
    .single();
  if (!creditNote?.customers?.email) return;

  const settings = await getCompanySettings();
  const pdfBuffer = await renderCreditNotePdf(creditNote as unknown as CreditNoteWithItems, settings);
  const content = creditNoteIssuedEmail({
    companyName: settings.company_name,
    customerName: creditNote.customers.company_name,
    creditNoteNumber: creditNote.credit_note_number,
    total: creditNote.total,
    currency: settings.default_currency,
  });

  await sendEmail({
    to: creditNote.customers.email,
    ...content,
    emailType: "credit_note_issued",
    entity: "credit_notes",
    entityId: creditNoteId,
    attachment: { filename: `${creditNote.credit_note_number}.pdf`, content: pdfBuffer },
  });
}
