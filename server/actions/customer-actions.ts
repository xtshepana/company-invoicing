"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireModuleAccess } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { generateUniqueCustomerReference } from "@/server/services/customers";
import { customerSchema } from "@/lib/validations/customers";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Json, TablesInsert } from "@/types/database";

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) obj[key] = value;
  return obj;
}

function toRow(data: ReturnType<typeof customerSchema.parse>): TablesInsert<"customers"> {
  return {
    ...data,
    payment_terms_days: data.payment_terms_days === "" ? null : data.payment_terms_days,
  };
}

/** 23505 = unique_violation. Only customer_reference has a unique index on this table, so any hit here is that one. */
function customerSaveErrorMessage(error: { code?: string }): string {
  if (error.code === "23505") {
    return "That customer reference is already in use. Leave it blank to auto-generate one, or choose a different value.";
  }
  return "Unable to save this customer. Please try again.";
}

export async function createCustomerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("customers");

  const parsed = customerSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const customerReference =
    parsed.data.customer_reference || (await generateUniqueCustomerReference(supabase, parsed.data.company_name));

  const { data: inserted, error } = await supabase
    .from("customers")
    .insert({ ...toRow(parsed.data), customer_reference: customerReference, created_by: actor.id })
    .select("id")
    .single();

  if (error) {
    return { error: customerSaveErrorMessage(error) };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "customer.created",
    entity: "customers",
    entityId: inserted.id,
    newValue: parsed.data as unknown as Json,
  });

  revalidatePath("/customers");
  redirect(`/customers/${inserted.id}`);
}

export async function updateCustomerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("customers");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing customer." };

  const parsed = customerSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("customers").select("*").eq("id", id).single();

  const customerReference =
    parsed.data.customer_reference || (await generateUniqueCustomerReference(supabase, parsed.data.company_name));

  const { error } = await supabase
    .from("customers")
    .update({ ...toRow(parsed.data), customer_reference: customerReference })
    .eq("id", id);
  if (error) {
    return { error: customerSaveErrorMessage(error) };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "customer.updated",
    entity: "customers",
    entityId: id,
    oldValue: before as unknown as Json,
    newValue: parsed.data as unknown as Json,
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function setCustomerActiveAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("customers");

  const id = formData.get("id");
  const isActive = formData.get("is_active") === "true";
  if (typeof id !== "string" || !id) return { error: "Missing customer." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("customers").update({ is_active: isActive }).eq("id", id);
  if (error) {
    return { error: "Unable to update this customer. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: isActive ? "customer.reactivated" : "customer.archived",
    entity: "customers",
    entityId: id,
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true };
}
