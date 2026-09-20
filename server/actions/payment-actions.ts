"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireModuleAccess } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { recordPaymentSchema, applyCreditSchema } from "@/lib/validations/payments";
import { getCompanySettings } from "@/lib/config/system-settings";
import { sendEmail } from "@/server/services/email";
import { paymentReceiptEmail } from "@/lib/email/templates";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Json } from "@/types/database";

function parseFormData(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "invoice_allocations") continue;
    obj[key] = value;
  }
  const raw = formData.get("invoice_allocations");
  try {
    obj.invoice_allocations = typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    obj.invoice_allocations = [];
  }
  return obj;
}

export async function recordPaymentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("payments");

  const parsed = recordPaymentSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const bankTransactionId = parsed.data.bank_transaction_id || undefined;
  if (bankTransactionId) {
    await requireModuleAccess("banking");
  }

  const sumAllocated = parsed.data.invoice_allocations.reduce((sum, a) => sum + a.amount, 0);
  if (sumAllocated > parsed.data.amount) {
    return { error: "Allocation total cannot exceed the payment amount." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: paymentId, error } = await supabase.rpc("record_payment", {
    p_customer_id: parsed.data.customer_id,
    p_payment_date: parsed.data.payment_date,
    p_amount: parsed.data.amount,
    p_payment_method: parsed.data.payment_method,
    p_bank_reference: parsed.data.bank_reference,
    p_description: parsed.data.description,
    p_notes: parsed.data.notes,
    p_invoice_allocations: parsed.data.invoice_allocations as unknown as Json,
    p_source: bankTransactionId ? "bank_reconciliation" : "manual",
    p_bank_transaction_id: bankTransactionId ?? null,
  });

  if (error || !paymentId) {
    return { error: error?.message ?? "Unable to record this payment. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "payment.recorded",
    entity: "payments",
    entityId: paymentId,
    newValue: { ...parsed.data, sum_allocated: sumAllocated } as unknown as Json,
  });

  await sendPaymentReceiptEmail(parsed.data.customer_id, parsed.data.amount, parsed.data.payment_date);

  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath(`/customers/${parsed.data.customer_id}`);
  if (bankTransactionId) revalidatePath("/bank-reconciliation");
  redirect(`/payments/${paymentId}`);
}

/** Uses the service-role client — see the matching comment on sendInvoiceSentEmail in invoice-actions.ts. */
async function sendPaymentReceiptEmail(customerId: string, amount: number, paymentDate: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data: customer } = await admin
    .from("customers")
    .select("email, company_name")
    .eq("id", customerId)
    .single();
  if (!customer?.email) return;

  const settings = await getCompanySettings();
  const content = paymentReceiptEmail({
    companyName: settings.company_name,
    customerName: customer.company_name,
    amount,
    paymentDate,
    currency: settings.default_currency,
  });

  await sendEmail({
    to: customer.email,
    ...content,
    emailType: "payment_receipt",
    entity: "customers",
    entityId: customerId,
  });
}

export async function applyCustomerCreditAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("payments");

  const parsed = applyCreditSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("apply_customer_credit", {
    p_customer_id: parsed.data.customer_id,
    p_invoice_id: parsed.data.invoice_id,
    p_amount: parsed.data.amount,
    p_notes: parsed.data.notes,
  });

  if (error) {
    return { error: error.message.includes("available credit") ? error.message : "Unable to apply credit. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "customer_credit.applied",
    entity: "customer_credits",
    entityId: parsed.data.invoice_id,
    newValue: parsed.data as unknown as Json,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${parsed.data.invoice_id}`);
  revalidatePath(`/customers/${parsed.data.customer_id}`);
  return { success: true };
}
