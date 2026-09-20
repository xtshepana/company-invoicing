"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import {
  appearanceSchema,
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

export async function updateAppearanceAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = appearanceSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  return applySettingsUpdate(parsed.data, "company_settings.appearance_updated");
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

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function uploadCompanyLogoAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose an image file." };
  }
  if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
    return { error: "Logo must be a PNG, JPEG, WEBP, or SVG image." };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { error: "Logo must be smaller than 2MB." };
  }

  const supabase = await createSupabaseServerClient();
  // Fixed path (not a random/unique one) so re-uploads overwrite the
  // previous logo instead of accumulating orphaned files in the bucket.
  const path = `logo/company-logo.${LOGO_EXTENSIONS[file.type]}`;

  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) {
    return { error: "Unable to upload logo. Please try again." };
  }

  const { data: publicUrlData } = supabase.storage.from("company-assets").getPublicUrl(path);
  // Cache-bust so the browser/PDF fetch the new file immediately after a
  // re-upload to the same fixed path instead of an old cached response.
  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { data: before } = await supabase.from("company_settings").select("*").eq("id", true).single();
  const { error } = await supabase.from("company_settings").update({ logo_url: logoUrl }).eq("id", true);
  if (error) {
    return { error: "Unable to save logo. Please try again." };
  }

  await recordAuditLog({
    userId: admin.id,
    action: "company_settings.logo_updated",
    entity: "company_settings",
    entityId: "singleton",
    oldValue: (before as unknown as Json) ?? null,
    newValue: { logo_url: logoUrl } as unknown as Json,
  });

  revalidatePath("/settings");
  return { success: true };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature
export async function removeCompanyLogoAction(_prev: ActionResult): Promise<ActionResult> {
  return applySettingsUpdate({ logo_url: null }, "company_settings.logo_removed");
}
