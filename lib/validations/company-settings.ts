import { z } from "zod";
import { HEX_COLOR_PATTERN } from "@/lib/color-utils";

export const PDF_TEMPLATES = ["classic", "modern", "minimal", "bold", "elegant", "corporate"] as const;

export const appearanceSchema = z.object({
  brand_color: z
    .union([z.literal(""), z.string().trim().regex(HEX_COLOR_PATTERN, "Must be a hex color like #2563eb.")])
    .transform((value) => (value === "" ? null : value)),
  /** The logo's second colour (set automatically when a logo is uploaded) - used by the Corporate template. */
  brand_color_secondary: z
    .union([z.literal(""), z.string().trim().regex(HEX_COLOR_PATTERN, "Must be a hex color like #2563eb.")])
    .transform((value) => (value === "" ? null : value)),
  pdf_template: z.enum(PDF_TEMPLATES),
  /** Whether the company name text is shown on generated PDFs, alongside the logo - see show_company_name on company_settings. */
  show_company_name: z.boolean(),
});
export type AppearanceInput = z.infer<typeof appearanceSchema>;

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
  vat_registered: z.boolean(),
  /** Day of the month (1-28) every month-based recurring invoice is created on. Empty = no fixed day. */
  recurring_billing_day: z
    .union([z.literal(""), z.coerce.number().int("Enter a whole day, 1 to 28.").min(1, "The day must be 1 to 28.").max(28, "The day must be 1 to 28.")])
    .transform((value) => (value === "" ? null : value)),
  /** Invoices generated from recurring invoices fall due on the last day of the month they are issued. */
  recurring_due_at_month_end: z.boolean(),
  default_vat_rate: z.coerce.number().min(0).max(100),
  default_prices_include_vat: z.boolean(),
  default_currency: z.string().trim().length(3),
  default_invoice_notes: z.string().max(2000).default(""),
  default_invoice_footer: z.string().max(2000).default(""),
  default_quote_terms: z.string().max(2000).default(""),
  payment_reminders_enabled: z.boolean(),
  /** Where the "no payment detected, review for suspension" notice goes after the final (10th) reminder checkpoint. */
  accounts_notification_email: z
    .union([z.literal(""), z.string().trim().email()])
    .transform((value) => (value === "" ? null : value)),
  /** Where payment reminder checkpoint digests go for human review - reminders are never emailed to clients directly. */
  reminder_review_email: z
    .union([z.literal(""), z.string().trim().email()])
    .transform((value) => (value === "" ? null : value)),
});
export type InvoiceSettingsInput = z.infer<typeof invoiceSettingsSchema>;
