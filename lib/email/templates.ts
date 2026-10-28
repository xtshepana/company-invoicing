import { formatCurrency } from "@/lib/money";
import { escapeHtml } from "@/lib/email/escape";
import { signatureHtml, type EmailSignature } from "@/lib/email/signature";

export interface EmailContent {
  subject: string;
  html: string;
}

function layout(companyName: string, bodyHtml: string, signature?: EmailSignature): string {
  return `
  <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0; color: #1a1a1a;">
    <div style="padding: 24px 0; border-bottom: 2px solid #1a1a1a; margin-bottom: 24px;">
      <strong style="font-size: 18px;">${escapeHtml(companyName)}</strong>
    </div>
    ${bodyHtml}
    ${signature ? signatureHtml(signature) : ""}
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888;">
      This is an automated message from ${escapeHtml(companyName)}.
    </div>
  </div>`;
}

/**
 * Shared body for the invoice/quotation "here's your document" emails -
 * same wording either way, just the document type word and the company
 * sign-off change. See invoiceSentEmail/quoteSentEmail.
 */
function documentSentBody(
  companyName: string,
  customerName: string,
  documentType: "invoice" | "quotation",
  signature?: EmailSignature
): string {
  return `
    <p>Dear ${escapeHtml(customerName)},</p>
    <p>Thank you for choosing ${escapeHtml(companyName)}.</p>
    <p>Please find attached your ${documentType} for your attention.</p>
    <p>If you have any questions or require any changes, please feel free to contact us. We are happy to assist.</p>
    <p>We appreciate your business and look forward to serving you.</p>
    ${signature ? "" : `<p>Kind regards,<br>${escapeHtml(companyName)}</p>`}
    `;
}

export function invoiceSentEmail(params: {
  companyName: string;
  customerName: string;
  invoiceNumber: string;
  signature?: EmailSignature;
}): EmailContent {
  const { companyName, customerName, invoiceNumber, signature } = params;
  return {
    subject: `Invoice ${invoiceNumber} from ${companyName}`,
    html: layout(companyName, documentSentBody(companyName, customerName, "invoice", signature), signature),
  };
}

export function quoteSentEmail(params: {
  companyName: string;
  customerName: string;
  quoteNumber: string;
  signature?: EmailSignature;
}): EmailContent {
  const { companyName, customerName, quoteNumber, signature } = params;
  return {
    subject: `Quotation ${quoteNumber} from ${companyName}`,
    html: layout(companyName, documentSentBody(companyName, customerName, "quotation", signature), signature),
  };
}

export function paymentReceiptEmail(params: {
  companyName: string;
  customerName: string;
  amount: number;
  paymentDate: string;
  currency: string;
  signature?: EmailSignature;
}): EmailContent {
  const { companyName, customerName, amount, paymentDate, currency, signature } = params;
  return {
    subject: `Payment received — ${companyName}`,
    html: layout(
      companyName,
      `
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>We've received your payment of <strong>${formatCurrency(amount, currency)}</strong> on ${new Date(paymentDate).toLocaleDateString("en-ZA")}.</p>
      <p>Thank you.</p>
      `,
      signature
    ),
  };
}

export function recurringInvoiceGeneratedEmail(params: {
  companyName: string;
  customerName: string;
  invoiceNumber: string;
  total: number;
  dueDate: string;
  currency: string;
  signature?: EmailSignature;
}): EmailContent {
  const { companyName, customerName, invoiceNumber, total, dueDate, currency, signature } = params;
  return {
    subject: `Invoice ${invoiceNumber} from ${companyName}`,
    html: layout(
      companyName,
      `
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>Your recurring invoice <strong>${escapeHtml(invoiceNumber)}</strong> for ${formatCurrency(total, currency)} is attached.</p>
      <p>Payment is due by ${new Date(dueDate).toLocaleDateString("en-ZA")}.</p>
      `,
      signature
    ),
  };
}

export function creditNoteIssuedEmail(params: {
  companyName: string;
  customerName: string;
  creditNoteNumber: string;
  total: number;
  currency: string;
  signature?: EmailSignature;
}): EmailContent {
  const { companyName, customerName, creditNoteNumber, total, currency, signature } = params;
  return {
    subject: `Credit note ${creditNoteNumber} from ${companyName}`,
    html: layout(
      companyName,
      `
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>Please find attached credit note <strong>${escapeHtml(creditNoteNumber)}</strong> for ${formatCurrency(total, currency)}.</p>
      <p>This amount has been added to your account as available credit.</p>
      `,
      signature
    ),
  };
}

/**
 * The client portal's entire sign-in flow - no password, just this link.
 * See server/services/client-auth.ts requestClientMagicLink(). The link
 * itself carries the one-time token; there's nothing to type.
 */
export function clientMagicLinkEmail(params: {
  companyName: string;
  loginUrl: string;
  expiresInMinutes: number;
}): EmailContent {
  const { companyName, loginUrl, expiresInMinutes } = params;
  return {
    subject: `Your sign-in link for ${companyName}`,
    html: layout(
      companyName,
      `
      <p>Use the link below to sign in to your client portal.</p>
      <p><a href="${escapeHtml(loginUrl)}" style="display: inline-block; padding: 10px 20px; background: #1a1a1a; color: #ffffff; text-decoration: none; border-radius: 4px;">Sign in</a></p>
      <p style="color: #555; font-size: 13px;">This link expires in ${expiresInMinutes} minutes and can only be used once. If you didn't request it, you can safely ignore this email.</p>
      `
    ),
  };
}

/**
 * Sent directly to the customer, but only ever on demand - a staff member
 * clicking "Send Reminder" on the invoice page (see sendPaymentReminderAction
 * in server/actions/invoice-actions.ts). Distinct from the automatic
 * checkpoint system's paymentReminderReviewEmail, which never emails the
 * customer directly; this one does, because a human decided to send it.
 */
export function paymentReminderEmail(params: {
  companyName: string;
  customerName: string;
  invoiceNumber: string;
  balanceDue: number;
  dueDate: string;
  currency: string;
  signature?: EmailSignature;
}): EmailContent {
  const { companyName, customerName, invoiceNumber, balanceDue, dueDate, currency, signature } = params;
  return {
    subject: `Payment reminder: Invoice ${invoiceNumber} from ${companyName}`,
    html: layout(
      companyName,
      `
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>This is a reminder that invoice <strong>${escapeHtml(invoiceNumber)}</strong> remains unpaid.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 0; color: #555;">Amount due</td><td style="text-align: right; font-weight: bold;">${formatCurrency(balanceDue, currency)}</td></tr>
        <tr><td style="padding: 4px 0; color: #555;">Due date</td><td style="text-align: right;">${new Date(dueDate).toLocaleDateString("en-ZA")}</td></tr>
      </table>
      <p>Please arrange payment at your earliest convenience. If you've already paid, please disregard this reminder.</p>
      `,
      signature
    ),
  };
}

export type ReminderEmailStage = "reminder_1" | "reminder_2";

const REMINDER_STAGE_LABEL: Record<ReminderEmailStage, string> = {
  reminder_1: "Reminder 1 (last day of the month)",
  reminder_2: "Final reminder (the 5th)",
};

export interface ReminderInvoiceLine {
  invoiceNumber: string;
  dueDate: string;
  balanceDue: number;
}

const TH = "padding: 6px 8px; border-bottom: 2px solid #1a1a1a;";
const TD = "padding: 6px 8px; border-bottom: 1px solid #e5e5e5;";

function invoiceRows(invoices: ReminderInvoiceLine[], currency: string): string {
  return invoices
    .map(
      (invoice) => `
      <tr>
        <td style="${TD}">${escapeHtml(invoice.invoiceNumber)}</td>
        <td style="${TD} text-align: right;">${new Date(invoice.dueDate).toLocaleDateString("en-ZA")}</td>
        <td style="${TD} text-align: right;">${formatCurrency(invoice.balanceDue, currency)}</td>
      </tr>`
    )
    .join("");
}

/**
 * The payment reminder a customer receives on the last day of the month (reminder 1) and on the 5th (the final
 * reminder). One email per customer listing every invoice of theirs that is overdue. It carries the account number as
 * the payment reference and, when the company has complete bank details, where to pay. Written to be firm but
 * courteous; it does not threaten any particular consequence, since that is the company's call.
 */
export function customerPaymentReminderEmail(params: {
  companyName: string;
  signature?: EmailSignature;
  customerName: string;
  accountNumber: string;
  invoices: ReminderInvoiceLine[];
  currency: string;
  stage: ReminderEmailStage;
  /** Complete bank details as display lines (see bankDetailsLines in lib/notices.ts), if the company has them. */
  bankLines?: string[];
}): EmailContent {
  const { companyName, signature, customerName, accountNumber, invoices, currency, stage, bankLines } = params;
  const total = invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
  const many = invoices.length > 1;
  const final = stage === "reminder_2";

  const intro = final
    ? `This is our <strong>final reminder</strong>. ${many ? "The invoices below are" : "The invoice below is"} overdue and our records show ${many ? "they are" : "it is"} still unpaid. Please make payment today.`
    : `This is a reminder that ${many ? "the invoices below are" : "the invoice below is"} now due, and our records show ${many ? "they are" : "it is"} still unpaid.`;

  return {
    subject: final
      ? `Final reminder from ${companyName}: payment outstanding`
      : `Payment reminder from ${companyName}: ${many ? `${invoices.length} unpaid invoices` : `invoice ${invoices[0]?.invoiceNumber ?? ""} is due`}`,
    html: layout(
      companyName,
      `
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>${intro}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr>
          <th style="${TH} text-align: left;">Invoice</th>
          <th style="${TH} text-align: right;">Due date</th>
          <th style="${TH} text-align: right;">Amount due</th>
        </tr>
        ${invoiceRows(invoices, currency)}
        ${many ? `<tr><td colspan="2" style="padding: 8px; text-align: right; font-weight: bold;">Total</td><td style="padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(total, currency)}</td></tr>` : ""}
      </table>
      ${accountNumber ? `<p>Please use your account number, <strong>${escapeHtml(accountNumber)}</strong>, as the payment reference.</p>` : ""}
      ${bankLines && bankLines.length > 0 ? `<p style="background: #f5f5f5; border-left: 3px solid #1a1a1a; padding: 10px 14px;">${bankLines.map(escapeHtml).join("<br>")}</p>` : ""}
      <p>If you have already paid, please send us your proof of payment and disregard this reminder.</p>
      `,
      signature
    ),
  };
}

export interface ReminderSummaryRow {
  accountNumber: string;
  customerName: string;
  invoiceNumbers: string[];
  total: number;
  /** Set for a customer that could not be emailed: why. */
  reason?: string;
}

/**
 * Sent to the owner after each reminder run: who was emailed and who could not be (no valid address, or the email
 * failed), so nobody silently drops out of the process.
 */
export function reminderSummaryEmail(params: {
  companyName: string;
  stage: ReminderEmailStage;
  currency: string;
  emailed: ReminderSummaryRow[];
  notEmailed: ReminderSummaryRow[];
}): EmailContent {
  const { companyName, stage, currency, emailed, notEmailed } = params;
  const label = REMINDER_STAGE_LABEL[stage];

  const table = (rows: ReminderSummaryRow[], showReason: boolean) => `
      <table style="width: 100%; border-collapse: collapse; margin: 12px 0 20px; font-size: 13px;">
        <tr>
          <th style="${TH} text-align: left;">Account No.</th>
          <th style="${TH} text-align: left;">Customer</th>
          <th style="${TH} text-align: left;">Invoices</th>
          <th style="${TH} text-align: right;">Amount due</th>
          ${showReason ? `<th style="${TH} text-align: left;">Why not emailed</th>` : ""}
        </tr>
        ${rows
          .map(
            (row) => `
        <tr>
          <td style="${TD}">${escapeHtml(row.accountNumber || "—")}</td>
          <td style="${TD}">${escapeHtml(row.customerName)}</td>
          <td style="${TD}">${escapeHtml(row.invoiceNumbers.join(", "))}</td>
          <td style="${TD} text-align: right;">${formatCurrency(row.total, currency)}</td>
          ${showReason ? `<td style="${TD}">${escapeHtml(row.reason ?? "")}</td>` : ""}
        </tr>`
          )
          .join("")}
      </table>`;

  return {
    subject: `${label}: ${emailed.length} customer${emailed.length === 1 ? "" : "s"} emailed${notEmailed.length > 0 ? `, ${notEmailed.length} could not be` : ""}`,
    html: layout(
      companyName,
      `
      <p><strong>${label}</strong> has been sent.</p>
      <p>${emailed.length} customer${emailed.length === 1 ? " was" : "s were"} emailed their reminder${emailed.length === 0 ? "." : ":"}</p>
      ${emailed.length > 0 ? table(emailed, false) : ""}
      ${notEmailed.length > 0 ? `<p><strong>${notEmailed.length} could not be emailed</strong> - please follow these up yourself:</p>${table(notEmailed, true)}` : ""}
      `
    ),
  };
}

export interface BlockingListItem {
  accountNumber: string;
  customerName: string;
  email: string;
  invoices: ReminderInvoiceLine[];
  balance: number;
  oldestDueDate: string;
}

/**
 * Sent to the owner on the 7th: every account that still has an unpaid invoice after both reminders, in one list, to
 * review for blocking. One email for the whole list - not one per invoice.
 */
export function accountBlockingListEmail(params: {
  companyName: string;
  currency: string;
  items: BlockingListItem[];
}): EmailContent {
  const { companyName, currency, items } = params;
  const total = items.reduce((sum, item) => sum + item.balance, 0);

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="${TD}">${escapeHtml(item.accountNumber || "—")}</td>
        <td style="${TD}">${escapeHtml(item.customerName)}<br><span style="color: #888; font-size: 12px;">${escapeHtml(item.email || "no email address")}</span></td>
        <td style="${TD}">${escapeHtml(item.invoices.map((invoice) => invoice.invoiceNumber).join(", "))}</td>
        <td style="${TD} text-align: right;">${new Date(item.oldestDueDate).toLocaleDateString("en-ZA")}</td>
        <td style="${TD} text-align: right; font-weight: bold;">${formatCurrency(item.balance, currency)}</td>
      </tr>`
    )
    .join("");

  return {
    subject: `Accounts to block: ${items.length} unpaid (${formatCurrency(total, currency)})`,
    html: layout(
      companyName,
      `
      <p>These <strong>${items.length}</strong> account${items.length === 1 ? " still has" : "s still have"} unpaid invoices after both payment
      reminders. Please review ${items.length === 1 ? "it" : "them"} for blocking.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <tr>
          <th style="${TH} text-align: left;">Account No.</th>
          <th style="${TH} text-align: left;">Customer</th>
          <th style="${TH} text-align: left;">Unpaid invoices</th>
          <th style="${TH} text-align: right;">Oldest due</th>
          <th style="${TH} text-align: right;">Balance</th>
        </tr>
        ${rows}
        <tr>
          <td colspan="4" style="padding: 8px; text-align: right; font-weight: bold;">Total unpaid</td>
          <td style="padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(total, currency)}</td>
        </tr>
      </table>
      `
    ),
  };
}

/**
 * A customer notice written in the Notices tab (e.g. a company name or
 * banking details change). `bodyHtml` is already escaped HTML from
 * renderNoticeBodyHtml (lib/notices.ts) - never pass raw text here. Sent to
 * each customer individually, so no one sees anyone else's address. There
 * is deliberately no automatic greeting: the message opens with whatever
 * the sender wrote ("Dear {customer_name}," or a group greeting such as
 * "Dear Kati Technologies customers,").
 */
export function customerNoticeEmail(params: {
  companyName: string;
  subject: string;
  bodyHtml: string;
  signature?: EmailSignature;
}): EmailContent {
  const { companyName, subject, bodyHtml, signature } = params;
  return {
    subject,
    html: layout(
      companyName,
      `
      ${bodyHtml}
      ${signature ? "" : `<p>Kind regards,<br>${escapeHtml(companyName)}</p>`}
      `,
      signature
    ),
  };
}
