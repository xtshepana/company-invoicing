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
 * Staff are signed out after this long with no mouse/keyboard/touch
 * activity in any open tab (see components/layout/idle-logout.tsx), with a
 * warning for the last IDLE_WARNING_SECONDS first. Client-side only - it
 * protects an unattended PC, it isn't a server-enforced session limit.
 */
export const IDLE_TIMEOUT_MINUTES = 15;
export const IDLE_WARNING_SECONDS = 60;

/**
 * Fixed calendar days-of-month at which every currently-unpaid invoice gets
 * a payment reminder — not relative to each invoice's own due date, since
 * this business's billing cycle is monthly and due dates cluster around
 * month-end regardless of when a given invoice was issued. `day: 30` is
 * clamped to the real last day of shorter months (so it still fires once,
 * on the 28th/29th, in February) — see `isPaymentCheckpointDay` in
 * app/api/cron/daily/route.tsx. The last checkpoint also triggers the
 * internal "still unpaid, review for suspension" notice to
 * `company_settings.accounts_notification_email` if nothing's been paid by
 * then. Whether reminders are sent at all is the one thing actually
 * configurable in Settings (`company_settings.payment_reminders_enabled`);
 * these dates are fixed rather than a full rules engine to keep the
 * feature proportional to what was asked for.
 */
export const PAYMENT_REMINDER_CHECKPOINTS = [
  { day: 30, checkpoint: "day_30" as const },
  { day: 5, checkpoint: "day_5" as const },
  { day: 10, checkpoint: "day_10" as const, isFinal: true },
];
