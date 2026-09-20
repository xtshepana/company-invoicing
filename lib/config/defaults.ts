/**
 * Fallback values only, used if the `company_settings` row is somehow
 * missing. The actual configured values always come from the database via
 * `server/services/company-settings.ts` — never hard-code these in feature
 * code.
 */
export const DEFAULT_APP_NAME = "Company Invoicing System";

export const SETTINGS_DEFAULTS = {
  companyName: DEFAULT_APP_NAME,
  defaultCurrency: "ZAR",
  defaultVatRate: 15,
  defaultPricesIncludeVat: false,
  defaultPaymentTermsDays: 30,
  invoicePrefix: "INV-",
  quotePrefix: "QUO-",
  creditNotePrefix: "CN-",
} as const;

/**
 * Days relative to an invoice's due date at which a payment reminder email
 * may be sent (negative = before due, 0 = due today, positive = days
 * overdue) — matches the exact example schedule in the spec. Whether
 * reminders are sent at all is the one thing actually configurable in
 * Settings (`company_settings.payment_reminders_enabled`); these offsets
 * are fixed rather than a full rules engine to keep the feature
 * proportional to what was asked for.
 */
export const REMINDER_OFFSET_DAYS = [-7, 0, 7, 14, 30] as const;
