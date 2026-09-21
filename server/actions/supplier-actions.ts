"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireModuleAccess } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { supplierSchema } from "@/lib/validations/suppliers";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Json } from "@/types/database";

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) obj[key] = value;
  return obj;
}

export async function createSupplierAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("suppliers");

  const parsed = supplierSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("suppliers")
    .insert({ ...parsed.data, created_by: actor.id })
    .select("id")
    .single();

  if (error) {
    return { error: "Unable to save this supplier. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "supplier.created",
    entity: "suppliers",
    entityId: inserted.id,
    newValue: parsed.data as unknown as Json,
  });

  revalidatePath("/suppliers");
  redirect(`/suppliers/${inserted.id}`);
}

export async function updateSupplierAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("suppliers");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing supplier." };

  const parsed = supplierSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("suppliers").select("*").eq("id", id).single();

  const { error } = await supabase.from("suppliers").update(parsed.data).eq("id", id);
  if (error) {
    return { error: "Unable to save this supplier. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "supplier.updated",
    entity: "suppliers",
    entityId: id,
    oldValue: before as unknown as Json,
    newValue: parsed.data as unknown as Json,
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  redirect(`/suppliers/${id}`);
}

export async function setSupplierActiveAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("suppliers");

  const id = formData.get("id");
  const isActive = formData.get("is_active") === "true";
  if (typeof id !== "string" || !id) return { error: "Missing supplier." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("suppliers").update({ is_active: isActive }).eq("id", id);
  if (error) {
    return { error: "Unable to update this supplier. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: isActive ? "supplier.reactivated" : "supplier.archived",
    entity: "suppliers",
    entityId: id,
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return { success: true };
}
