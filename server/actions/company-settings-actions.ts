"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import {
  bankDetailsSchema,
  companyProfileSchema,
  invoiceSettingsSchema,
} from "@/lib/validations/company-settings";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Json, TablesUpdate } from "@/types/database";

function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "default_prices_include_vat" || key === "payment_reminders_enabled") {
      obj[key] = value === "on" || value === "true";
      continue;
    }
    obj[key] = value;
  }
  if (!("default_prices_include_vat" in obj)) obj.default_prices_include_vat = false;
  if (!("payment_reminders_enabled" in obj)) obj.payment_reminders_enabled = false;
  return obj;
}

async function applySettingsUpdate(
  patch: TablesUpdate<"company_settings">,
  auditAction: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: before } = await supabase.from("company_settings").select("*").eq("id", true).single();

  const { error } = await supabase.from("company_settings").update(patch).eq("id", true);
  if (error) {
    return { error: "Unable to save settings. Please try again." };
  }

  await recordAuditLog({
    userId: admin.id,
    action: auditAction,
    entity: "company_settings",
    entityId: "singleton",
    oldValue: (before as unknown as Json) ?? null,
    newValue: patch as unknown as Json,
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function updateCompanyProfileAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = companyProfileSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  return applySettingsUpdate(parsed.data, "company_settings.profile_updated");
}

export async function updateBankDetailsAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = bankDetailsSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  return applySettingsUpdate(parsed.data, "company_settings.bank_details_updated");
}

export async function updateInvoiceSettingsAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = invoiceSettingsSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  return applySettingsUpdate(parsed.data, "company_settings.invoice_settings_updated");
}
