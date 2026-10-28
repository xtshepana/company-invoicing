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
 * Master switch for the client portal's sign-in (see server/services/client-auth.ts
 * and app/client/login/page.tsx). Off for now: the emailed magic link is
 * built from SITE_URL and that has been resolving to the host's internal
 * 0.0.0.0:3000 address, so a customer who requested a link would get one
 * that doesn't open. Flip to true once links point at the real domain.
 * While off, no sign-in email is sent, no link is accepted, and any
 * existing client session stops working.
 */
export const CLIENT_PORTAL_ENABLED = false as boolean;

/**
 * Staff are signed out after this long with no mouse/keyboard/touch
 * activity in any open tab (see components/layout/idle-logout.tsx), with a
 * warning for the last IDLE_WARNING_SECONDS first. Client-side only - it
 * protects an unattended PC, it isn't a server-enforced session limit.
 */
export const IDLE_TIMEOUT_MINUTES = 15;
export const IDLE_WARNING_SECONDS = 60;

// The payment reminder calendar (last day of the month, the 5th, the 7th) lives in lib/reminder-schedule.ts.

