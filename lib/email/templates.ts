import { formatCurrency } from "@/lib/money";

export interface EmailContent {
  subject: string;
  html: string;
}

function layout(companyName: string, bodyHtml: string): string {
  return `
  <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
    <div style="padding: 24px 0; border-bottom: 2px solid #1a1a1a; margin-bottom: 24px;">
      <strong style="font-size: 18px;">${escapeHtml(companyName)}</strong>
    </div>
    ${bodyHtml}
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888;">
      This is an automated message from ${escapeHtml(companyName)}.
    </div>
  </div>`;
}

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

/**
 * Shared body for the invoice/quotation "here's your document" emails -
 * same wording either way, just the document type word and the company
 * sign-off change. See invoiceSentEmail/quoteSentEmail.
 */
function documentSentBody(companyName: string, customerName: string, documentType: "invoice" | "quotation"): string {
  return `
    <p>Dear ${escapeHtml(customerName)},</p>
    <p>Thank you for choosing ${escapeHtml(companyName)}.</p>
    <p>Please find attached your ${documentType} for your attention.</p>
    <p>If you have any questions or require any changes, please feel free to contact us. We are happy to assist.</p>
    <p>We appreciate your business and look forward to serving you.</p>
    <p>Kind regards,<br>${escapeHtml(companyName)}</p>
    `;
}

export function invoiceSentEmail(params: {
  companyName: string;
  customerName: string;
  invoiceNumber: string;
}): EmailContent {
  const { companyName, customerName, invoiceNumber } = params;
  return {
    subject: `Invoice ${invoiceNumber} from ${companyName}`,
    html: layout(companyName, documentSentBody(companyName, customerName, "invoice")),
  };
}

export function quoteSentEmail(params: {
  companyName: string;
  customerName: string;
  quoteNumber: string;
}): EmailContent {
  const { companyName, customerName, quoteNumber } = params;
  return {
    subject: `Quotation ${quoteNumber} from ${companyName}`,
    html: layout(companyName, documentSentBody(companyName, customerName, "quotation")),
  };
}

export function paymentReceiptEmail(params: {
  companyName: string;
  customerName: string;
  amount: number;
  paymentDate: string;
  currency: string;
}): EmailContent {
  const { companyName, customerName, amount, paymentDate, currency } = params;
  return {
    subject: `Payment received — ${companyName}`,
    html: layout(
      companyName,
      `
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>We've received your payment of <strong>${formatCurrency(amount, currency)}</strong> on ${new Date(paymentDate).toLocaleDateString("en-ZA")}.</p>
      <p>Thank you.</p>
      `
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
}): EmailContent {
  const { companyName, customerName, invoiceNumber, total, dueDate, currency } = params;
  return {
    subject: `Invoice ${invoiceNumber} from ${companyName}`,
    html: layout(
      companyName,
      `
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>Your recurring invoice <strong>${escapeHtml(invoiceNumber)}</strong> for ${formatCurrency(total, currency)} is attached.</p>
      <p>Payment is due by ${new Date(dueDate).toLocaleDateString("en-ZA")}.</p>
      `
    ),
  };
}

export function creditNoteIssuedEmail(params: {
  companyName: string;
  customerName: string;
  creditNoteNumber: string;
  total: number;
  currency: string;
}): EmailContent {
  const { companyName, customerName, creditNoteNumber, total, currency } = params;
  return {
    subject: `Credit note ${creditNoteNumber} from ${companyName}`,
    html: layout(
      companyName,
      `
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>Please find attached credit note <strong>${escapeHtml(creditNoteNumber)}</strong> for ${formatCurrency(total, currency)}.</p>
      <p>This amount has been added to your account as available credit.</p>
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
}): EmailContent {
  const { companyName, customerName, invoiceNumber, balanceDue, dueDate, currency } = params;
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
      `
    ),
  };
}

const REMINDER_CHECKPOINT_LABEL: Record<"day_30" | "day_5" | "day_10", string> = {
  day_30: "30th (due)",
  day_5: "5th (overdue)",
  day_10: "10th (final notice)",
};

export interface ReminderReviewItem {
  accountNumber: string;
  customerName: string;
  invoiceNumber: string;
  balanceDue: number;
  dueDate: string;
}

/**
 * Safety gate: reminders are never emailed to clients directly. Instead,
 * whoever's in arrears at a given checkpoint gets listed in one digest to a
 * human (company_settings.reminder_review_email) who decides who actually
 * gets reminded, and how.
 */
export function paymentReminderReviewEmail(params: {
  companyName: string;
  checkpoint: "day_30" | "day_5" | "day_10";
  currency: string;
  items: ReminderReviewItem[];
}): EmailContent {
  const { companyName, checkpoint, currency, items } = params;
  const label = REMINDER_CHECKPOINT_LABEL[checkpoint];

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(item.accountNumber || "—")}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(item.customerName)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(item.invoiceNumber)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatCurrency(item.balanceDue, currency)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e5e5; text-align: right;">${new Date(item.dueDate).toLocaleDateString("en-ZA")}</td>
      </tr>`
    )
    .join("");

  return {
    subject: `Payment reminder review — ${items.length} client${items.length === 1 ? "" : "s"} in arrears (${label})`,
    html: layout(
      companyName,
      `
      <p>The following ${items.length === 1 ? "client is" : "clients are"} in arrears as of the
      <strong>${label}</strong> checkpoint. Nothing has been emailed to them automatically — review and
      send reminders manually where appropriate.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <tr>
          <th style="padding: 6px 8px; text-align: left; border-bottom: 2px solid #1a1a1a;">Account No.</th>
          <th style="padding: 6px 8px; text-align: left; border-bottom: 2px solid #1a1a1a;">Customer</th>
          <th style="padding: 6px 8px; text-align: left; border-bottom: 2px solid #1a1a1a;">Invoice</th>
          <th style="padding: 6px 8px; text-align: right; border-bottom: 2px solid #1a1a1a;">Amount due</th>
          <th style="padding: 6px 8px; text-align: right; border-bottom: 2px solid #1a1a1a;">Due date</th>
        </tr>
        ${rows}
      </table>
      `
    ),
  };
}

/**
 * A separate, more urgent internal notice after the final reminder
 * checkpoint if an invoice is still unpaid — for the accounts/admin team
 * to review the account for suspension. Distinct from the general
 * paymentReminderReviewEmail digest: this one flags a single invoice that's
 * gone all the way to the final checkpoint with no payment.
 */
export function accountBlockNoticeEmail(params: {
  companyName: string;
  customerName: string;
  invoiceNumber: string;
  balanceDue: number;
  dueDate: string;
  currency: string;
}): EmailContent {
  const { companyName, customerName, invoiceNumber, balanceDue, dueDate, currency } = params;
  return {
    subject: `Action needed: ${customerName} still unpaid — review for suspension`,
    html: layout(
      companyName,
      `
      <p>No payment has been detected for <strong>${escapeHtml(customerName)}</strong> after the final
      reminder on invoice <strong>${escapeHtml(invoiceNumber)}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 0; color: #555;">Customer</td><td style="text-align: right; font-weight: bold;">${escapeHtml(customerName)}</td></tr>
        <tr><td style="padding: 4px 0; color: #555;">Invoice</td><td style="text-align: right;">${escapeHtml(invoiceNumber)}</td></tr>
        <tr><td style="padding: 4px 0; color: #555;">Amount overdue</td><td style="text-align: right; font-weight: bold;">${formatCurrency(balanceDue, currency)}</td></tr>
        <tr><td style="padding: 4px 0; color: #555;">Due date</td><td style="text-align: right;">${new Date(dueDate).toLocaleDateString("en-ZA")}</td></tr>
      </table>
      <p>Please review this account for suspension.</p>
      `
    ),
  };
}
