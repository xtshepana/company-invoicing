"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireModuleAccess } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { recurringInvoiceSchema, RECURRING_STATUSES } from "@/lib/validations/recurring-invoices";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Json } from "@/types/database";
import type { LineItemInput } from "@/lib/validations/line-items";

/**
 * create_recurring_invoice/update_recurring_invoice's line-item insert reads
 * sort_order out of the jsonb payload (there's no computeDocumentTotals()
 * step for recurring templates, unlike invoices/quotes, since there are no
 * totals to snapshot yet) — the raw form line items never carry it, so it
 * has to be added here or the insert fails its not-null constraint.
 */
function withSortOrder(lineItems: LineItemInput[]) {
  return lineItems.map((item, index) => ({ ...item, sort_order: index }));
}

function parseFormData(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "line_items") continue;
    if (key === "prices_include_vat" || key === "auto_generate" || key === "auto_send_email") {
      obj[key] = value === "on" || value === "true";
      continue;
    }
    obj[key] = value;
  }
  for (const boolKey of ["prices_include_vat", "auto_generate", "auto_send_email"]) {
    if (!(boolKey in obj)) obj[boolKey] = false;
  }
  const raw = formData.get("line_items");
  try {
    obj.line_items = typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    obj.line_items = [];
  }
  return obj;
}

export async function createRecurringInvoiceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("recurring_invoices");

  const parsed = recurringInvoiceSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: id, error } = await supabase.rpc("create_recurring_invoice", {
    p_customer_id: parsed.data.customer_id,
    p_description: parsed.data.description,
    p_frequency: parsed.data.frequency,
    p_custom_interval_days: parsed.data.custom_interval_days === "" ? null : parsed.data.custom_interval_days,
    p_start_date: parsed.data.start_date,
    p_end_date: parsed.data.end_date || null,
    p_payment_terms_days: parsed.data.payment_terms_days === "" ? null : parsed.data.payment_terms_days,
    p_prices_include_vat: parsed.data.prices_include_vat,
    p_auto_generate: parsed.data.auto_generate,
    p_auto_send_email: parsed.data.auto_send_email,
    p_notes: parsed.data.notes,
    p_terms: parsed.data.terms,
    p_line_items: withSortOrder(parsed.data.line_items) as unknown as Json,
  });

  if (error || !id) {
    return { error: "Unable to save this recurring invoice. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "recurring_invoice.created",
    entity: "recurring_invoices",
    entityId: id,
    newValue: parsed.data as unknown as Json,
  });

  revalidatePath("/recurring-invoices");
  redirect(`/recurring-invoices/${id}`);
}

export async function updateRecurringInvoiceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("recurring_invoices");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing recurring invoice." };

  const parsed = recurringInvoiceSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_recurring_invoice", {
    p_id: id,
    p_customer_id: parsed.data.customer_id,
    p_description: parsed.data.description,
    p_frequency: parsed.data.frequency,
    p_custom_interval_days: parsed.data.custom_interval_days === "" ? null : parsed.data.custom_interval_days,
    p_end_date: parsed.data.end_date || null,
    p_payment_terms_days: parsed.data.payment_terms_days === "" ? null : parsed.data.payment_terms_days,
    p_prices_include_vat: parsed.data.prices_include_vat,
    p_auto_generate: parsed.data.auto_generate,
    p_auto_send_email: parsed.data.auto_send_email,
    p_notes: parsed.data.notes,
    p_terms: parsed.data.terms,
    p_line_items: withSortOrder(parsed.data.line_items) as unknown as Json,
  });

  if (error) {
    return { error: "Unable to save this recurring invoice. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "recurring_invoice.updated",
    entity: "recurring_invoices",
    entityId: id,
    newValue: parsed.data as unknown as Json,
  });

  revalidatePath("/recurring-invoices");
  revalidatePath(`/recurring-invoices/${id}`);
  redirect(`/recurring-invoices/${id}`);
}

export async function setRecurringInvoiceStatusAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("recurring_invoices");

  const id = formData.get("id");
  const statusInput = formData.get("status");
  if (typeof id !== "string" || !id) return { error: "Missing recurring invoice." };
  if (typeof statusInput !== "string" || !RECURRING_STATUSES.includes(statusInput as (typeof RECURRING_STATUSES)[number])) {
    return { error: "Invalid status." };
  }
  const status = statusInput as (typeof RECURRING_STATUSES)[number];

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("recurring_invoices").update({ status }).eq("id", id);
  if (error) return { error: "Unable to update this recurring invoice. Please try again." };

  await recordAuditLog({
    userId: actor.id,
    action: "recurring_invoice.status_changed",
    entity: "recurring_invoices",
    entityId: id,
    newValue: { status: statusInput },
  });

  revalidatePath("/recurring-invoices");
  revalidatePath(`/recurring-invoices/${id}`);
  return { success: true };
}

export async function skipNextRecurringInvoiceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("recurring_invoices");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing recurring invoice." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("skip_next_recurring_invoice", { p_id: id });
  if (error) return { error: "Unable to skip the next invoice. Please try again." };

  await recordAuditLog({
    userId: actor.id,
    action: "recurring_invoice.skipped_next",
    entity: "recurring_invoices",
    entityId: id,
  });

  revalidatePath("/recurring-invoices");
  revalidatePath(`/recurring-invoices/${id}`);
  return { success: true };
}
