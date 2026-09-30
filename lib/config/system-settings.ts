import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SETTINGS_DEFAULTS } from "@/lib/config/defaults";
import type { Tables } from "@/types/database";

export type CompanySettings = Tables<"company_settings">;

/**
 * Reads the single company_settings row. Configurable business values
 * (VAT rate, invoice numbering, terms, etc.) must always be read through
 * here, never hard-coded in feature code. Falls back to lib/config/defaults
 * only if the row is somehow missing.
 *
 * Wrapped in React's cache() — the layout and nearly every page under it
 * read this same singleton row, so this dedupes them to one query per
 * request.
 */
export const getCompanySettings = cache(async (): Promise<CompanySettings> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) {
    const now = new Date().toISOString();
    return {
      id: true,
      company_name: SETTINGS_DEFAULTS.companyName,
      trading_name: "",
      registration_number: "",
      vat_number: "",
      address_physical: "",
      address_postal: "",
      phone: "",
      email: "",
      website: "",
      logo_url: null,
      brand_color: null,
      bank_name: "",
      bank_account_name: "",
      bank_account_number: "",
      bank_branch_code: "",
      bank_account_type: "",
      invoice_prefix: SETTINGS_DEFAULTS.invoicePrefix,
      invoice_next_number: 1,
      quote_prefix: SETTINGS_DEFAULTS.quotePrefix,
      quote_next_number: 1,
      credit_note_prefix: SETTINGS_DEFAULTS.creditNotePrefix,
      credit_note_next_number: 1,
      customer_next_number: 1,
      default_payment_terms_days: SETTINGS_DEFAULTS.defaultPaymentTermsDays,
      default_vat_rate: SETTINGS_DEFAULTS.defaultVatRate,
      default_prices_include_vat: SETTINGS_DEFAULTS.defaultPricesIncludeVat,
      default_currency: SETTINGS_DEFAULTS.defaultCurrency,
      default_invoice_notes: "",
      default_invoice_footer: "",
      default_quote_terms: "",
      payment_reminders_enabled: true,
      vat_registered: false,
      pdf_template: "classic",
      show_company_name: true,
      accounts_notification_email: null,
      updated_at: now,
    };
  }

  return data;
});

/**
 * Just the logo, for the pre-auth pages (login, forgot/reset password).
 * Those pages render before a session exists, so `getCompanySettings()`
 * (RLS-scoped to active staff) can't be used there - this goes through
 * the service-role client instead, matching how server/services/email.ts
 * reads data purely to build a system-generated record, not to expose it
 * back to an unauthenticated caller. Only the logo URL, nothing else.
 */
export const getPublicBranding = cache(async (): Promise<{ logoUrl: string | null }> => {
  const admin = createAdminSupabaseClient();
  const { data } = await admin.from("company_settings").select("logo_url").eq("id", true).maybeSingle();
  return { logoUrl: data?.logo_url ?? null };
});
