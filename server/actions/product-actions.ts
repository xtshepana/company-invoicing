"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireModuleAccess } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { productSchema } from "@/lib/validations/products";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Json, TablesInsert } from "@/types/database";

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) obj[key] = value;
  return obj;
}

function toRow(data: ReturnType<typeof productSchema.parse>): TablesInsert<"products"> {
  return {
    ...data,
    cost_price: data.cost_price === "" ? null : data.cost_price,
  };
}

export async function createProductAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("products");

  const parsed = productSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("products")
    .insert({ ...toRow(parsed.data), created_by: actor.id })
    .select("id")
    .single();

  if (error) {
    return { error: "Unable to save this item. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "product.created",
    entity: "products",
    entityId: inserted.id,
    newValue: parsed.data as unknown as Json,
  });

  revalidatePath("/products");
  return { success: true };
}

export async function updateProductAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("products");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing item." };

  const parsed = productSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("products").select("*").eq("id", id).single();

  const { error } = await supabase.from("products").update(toRow(parsed.data)).eq("id", id);
  if (error) {
    return { error: "Unable to save this item. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "product.updated",
    entity: "products",
    entityId: id,
    oldValue: before as unknown as Json,
    newValue: parsed.data as unknown as Json,
  });

  revalidatePath("/products");
  return { success: true };
}

export async function setProductActiveAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("products");

  const id = formData.get("id");
  const isActive = formData.get("is_active") === "true";
  if (typeof id !== "string" || !id) return { error: "Missing item." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) {
    return { error: "Unable to update this item. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: isActive ? "product.reactivated" : "product.archived",
    entity: "products",
    entityId: id,
  });

  revalidatePath("/products");
  return { success: true };
}
