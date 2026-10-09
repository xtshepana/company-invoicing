/**
 * Pure logic for customer notices (the Notices tab): placeholders, bank
 * details, safe HTML rendering and recipient email checks. Nothing here
 * touches the database or sends anything, so it can be tested directly and
 * used for the live preview in the browser.
 */

/** Placeholders a notice may use. `bank_details` is body-only. */
export const NOTICE_PLACEHOLDERS = [
  "customer_name",
  "account_number",
  "company_name",
  "company_email",
  "company_phone",
  "bank_details",
] as const;
export type NoticePlaceholder = (typeof NOTICE_PLACEHOLDERS)[number];

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
}

export interface NoticeCompany {
  name: string;
  email: string;
  phone: string;
  bank: BankDetails | null;
}

export interface NoticeVars {
  customerName: string;
  accountNumber: string;
  company: NoticeCompany;
}

export const BANKING_CHANGE_TEMPLATE = {
  subject: "Important: new company name and banking details - {company_name}",
  body: `Dear Kati Technologies customers,

Please note that we have changed our company name and banking details. From now on, your services and invoices will come from {company_name}.

Please update your records and make all future payments to the account below:

{bank_details}

Please use your account number, {account_number}, as the payment reference.

Your services are not affected by this change. For your security, please confirm these details with us on {company_phone} or at {company_email} before making your next payment.

Thank you for your continued support.`,
};

const PLACEHOLDER_TOKEN = /\{([a-z_]+)\}/g;
const EMAIL_PATTERN = /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]{2,}$/;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/** One address only - a customer with "a@x.com; b@y.com" or no email is reported rather than guessed at. */
export function deliverableEmail(email: string | null | undefined): string | null {
  const value = email?.trim() ?? "";
  return EMAIL_PATTERN.test(value) ? value : null;
}

/** Only complete details count: a half-filled bank block in a "we've changed banks" email would be worse than none. */
export function bankDetailsFromSettings(settings: {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_account_type: string;
}): BankDetails | null {
  const bankName = settings.bank_name.trim();
  const accountName = settings.bank_account_name.trim();
  const accountNumber = settings.bank_account_number.trim();
  if (!bankName || !accountName || !accountNumber) return null;
  return {
    bankName,
    accountName,
    accountNumber,
    branchCode: settings.bank_branch_code.trim(),
    accountType: settings.bank_account_type.trim(),
  };
}

export function noticeCompanyFromSettings(settings: {
  company_name: string;
  email: string;
  phone: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_account_type: string;
}): NoticeCompany {
  return {
    name: settings.company_name,
    email: settings.email,
    phone: settings.phone,
    bank: bankDetailsFromSettings(settings),
  };
}

export function bankDetailsLines(bank: BankDetails): string[] {
  const lines = [`Bank: ${bank.bankName}`, `Account name: ${bank.accountName}`, `Account number: ${bank.accountNumber}`];
  if (bank.branchCode) lines.push(`Branch code: ${bank.branchCode}`);
  if (bank.accountType) lines.push(`Account type: ${bank.accountType}`);
  return lines;
}

export function findPlaceholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_TOKEN)].map((match) => match[1]);
}

/** Anything in {braces} that isn't a known placeholder - sending it would put literal "{typo}" in front of customers. */
export function findUnknownPlaceholders(text: string, options: { allowBankDetails: boolean }): string[] {
  const allowed = new Set<string>(NOTICE_PLACEHOLDERS.filter((name) => options.allowBankDetails || name !== "bank_details"));
  return [...new Set(findPlaceholders(text).filter((name) => !allowed.has(name)))];
}

export function usesBankDetails(text: string): boolean {
  return findPlaceholders(text).includes("bank_details");
}

function valueFor(name: NoticePlaceholder, vars: NoticeVars): string {
  switch (name) {
    case "customer_name":
      return vars.customerName;
    case "account_number":
      return vars.accountNumber;
    case "company_name":
      return vars.company.name;
    case "company_email":
      return vars.company.email;
    case "company_phone":
      return vars.company.phone;
    case "bank_details":
      return vars.company.bank ? bankDetailsLines(vars.company.bank).join("\n") : "[bank details not set in Settings]";
  }
}

function isKnown(name: string): name is NoticePlaceholder {
  return (NOTICE_PLACEHOLDERS as readonly string[]).includes(name);
}

/** Plain text (the email subject): known placeholders filled in, line breaks removed, nothing escaped. */
export function renderNoticeSubject(template: string, vars: NoticeVars): string {
  return template
    .replace(PLACEHOLDER_TOKEN, (token, name: string) =>
      isKnown(name) && name !== "bank_details" ? valueFor(name, vars).replace(/\s*\n\s*/g, " ") : token
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The message as email-safe HTML. Everything - the typed text and every
 * substituted value - is escaped, so a customer or company name can never
 * inject markup. Blank lines separate paragraphs; a paragraph that is just
 * {bank_details} becomes a highlighted box.
 */
export function renderNoticeBodyHtml(template: string, vars: NoticeVars): string {
  const paragraphs = template
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs
    .map((paragraph) => {
      if (paragraph === "{bank_details}" && vars.company.bank) {
        const lines = bankDetailsLines(vars.company.bank).map(escapeHtml).join("<br>");
        return `<div style="margin: 16px 0; padding: 12px 16px; background: #f6f6f6; border-left: 3px solid #1a1a1a; font-size: 14px; line-height: 1.7;">${lines}</div>`;
      }
      const html = paragraph
        .split(/(\{[a-z_]+\})/)
        .map((piece) => {
          const name = piece.slice(1, -1);
          return piece.startsWith("{") && piece.endsWith("}") && isKnown(name)
            ? escapeHtml(valueFor(name, vars))
            : escapeHtml(piece);
        })
        .join("")
        .replace(/\n/g, "<br>");
      return `<p>${html}</p>`;
    })
    .join("\n");
}

/**
 * The same checks run in the browser (to disable Send and explain why) and
 * again on the server before anything is emailed. Returns a message, or null
 * when the notice is fine to send.
 */
export function validateNoticeContent(subject: string, body: string, company: NoticeCompany): string | null {
  const unknown = [
    ...findUnknownPlaceholders(subject, { allowBankDetails: false }),
    ...findUnknownPlaceholders(body, { allowBankDetails: true }),
  ];
  if (unknown.length > 0) {
    const known = NOTICE_PLACEHOLDERS.map((name) => `{${name}}`).join(", ");
    const typed = [...new Set(unknown)].map((name) => `{${name}}`).join(", ");
    return `Unknown placeholder ${typed}. You can use: ${known}.`;
  }
  if (usesBankDetails(body) && !company.bank) {
    return "Your message uses {bank_details}, but the bank name, account name and account number aren't all filled in under Settings > Bank details.";
  }
  return null;
}
