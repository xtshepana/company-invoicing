"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireModuleAccess } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { expenseSchema } from "@/lib/validations/suppliers";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Json, TablesInsert } from "@/types/database";

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) obj[key] = value;
  return obj;
}

function toRow(data: ReturnType<typeof expenseSchema.parse>): TablesInsert<"expenses"> {
  return {
    ...data,
    supplier_id: data.supplier_id === "" ? null : data.supplier_id,
  };
}

export async function createExpenseAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("suppliers");

  const parsed = expenseSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("expenses")
    .insert({ ...toRow(parsed.data), created_by: actor.id })
    .select("id")
    .single();

  if (error) {
    return { error: "Unable to save this expense. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "expense.created",
    entity: "expenses",
    entityId: inserted.id,
    newValue: parsed.data as unknown as Json,
  });

  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function updateExpenseAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("suppliers");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing expense." };

  const parsed = expenseSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("expenses").select("*").eq("id", id).single();

  const { error } = await supabase.from("expenses").update(toRow(parsed.data)).eq("id", id);
  if (error) {
    return { error: "Unable to save this expense. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "expense.updated",
    entity: "expenses",
    entityId: id,
    oldValue: before as unknown as Json,
    newValue: parsed.data as unknown as Json,
  });

  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function deleteExpenseAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("suppliers");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing expense." };

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("expenses").select("*").eq("id", id).single();

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) {
    return { error: "Unable to delete this expense. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "expense.deleted",
    entity: "expenses",
    entityId: id,
    oldValue: before as unknown as Json,
  });

  revalidatePath("/expenses");
  return { success: true };
}
