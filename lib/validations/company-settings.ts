import { z } from "zod";

export const companyProfileSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required.").max(200),
  trading_name: z.string().trim().max(200).default(""),
  registration_number: z.string().trim().max(100).default(""),
  vat_number: z.string().trim().max(100).default(""),
  address_physical: z.string().trim().max(500).default(""),
  address_postal: z.string().trim().max(500).default(""),
  phone: z.string().trim().max(50).default(""),
  email: z.union([z.literal(""), z.string().trim().email()]).default(""),
  website: z.string().trim().max(200).default(""),
});
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export const bankDetailsSchema = z.object({
  bank_name: z.string().trim().max(200).default(""),
  bank_account_name: z.string().trim().max(200).default(""),
  bank_account_number: z.string().trim().max(50).default(""),
  bank_branch_code: z.string().trim().max(20).default(""),
  bank_account_type: z.string().trim().max(50).default(""),
});
export type BankDetailsInput = z.infer<typeof bankDetailsSchema>;

export const invoiceSettingsSchema = z.object({
  invoice_prefix: z.string().trim().min(1).max(20),
  invoice_next_number: z.coerce.number().int().positive(),
  quote_prefix: z.string().trim().min(1).max(20),
  quote_next_number: z.coerce.number().int().positive(),
  credit_note_prefix: z.string().trim().min(1).max(20),
  credit_note_next_number: z.coerce.number().int().positive(),
  default_payment_terms_days: z.coerce.number().int().min(0).max(365),
  default_vat_rate: z.coerce.number().min(0).max(100),
  default_prices_include_vat: z.boolean(),
  default_currency: z.string().trim().length(3),
  default_invoice_notes: z.string().max(2000).default(""),
  default_invoice_footer: z.string().max(2000).default(""),
  default_quote_terms: z.string().max(2000).default(""),
  payment_reminders_enabled: z.boolean(),
});
export type InvoiceSettingsInput = z.infer<typeof invoiceSettingsSchema>;
