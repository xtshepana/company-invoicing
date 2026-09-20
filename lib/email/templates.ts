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

export function invoiceSentEmail(params: {
  companyName: string;
  customerName: string;
  invoiceNumber: string;
  total: number;
  balanceDue: number;
  dueDate: string;
  currency: string;
}): EmailContent {
  const { companyName, customerName, invoiceNumber, total, balanceDue, dueDate, currency } = params;
  return {
    subject: `Invoice ${invoiceNumber} from ${companyName}`,
    html: layout(
      companyName,
      `
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>Please find attached invoice <strong>${escapeHtml(invoiceNumber)}</strong> for ${formatCurrency(total, currency)}.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 0; color: #555;">Amount due</td><td style="text-align: right; font-weight: bold;">${formatCurrency(balanceDue, currency)}</td></tr>
        <tr><td style="padding: 4px 0; color: #555;">Due date</td><td style="text-align: right;">${new Date(dueDate).toLocaleDateString("en-ZA")}</td></tr>
      </table>
      <p>Thank you for your business.</p>
      `
    ),
  };
}

export function quoteSentEmail(params: {
  companyName: string;
  customerName: string;
  quoteNumber: string;
  total: number;
  currency: string;
}): EmailContent {
  const { companyName, customerName, quoteNumber, total, currency } = params;
  return {
    subject: `Quotation ${quoteNumber} from ${companyName}`,
    html: layout(
      companyName,
      `
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>Please find attached quotation <strong>${escapeHtml(quoteNumber)}</strong> for ${formatCurrency(total, currency)}.</p>
      <p>Let us know if you have any questions.</p>
      `
    ),
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

export function paymentReminderEmail(params: {
  companyName: string;
  customerName: string;
  invoiceNumber: string;
  balanceDue: number;
  dueDate: string;
  currency: string;
  offsetDays: number;
}): EmailContent {
  const { companyName, customerName, invoiceNumber, balanceDue, dueDate, currency, offsetDays } = params;
  const timing =
    offsetDays < 0
      ? `is due in ${Math.abs(offsetDays)} day${Math.abs(offsetDays) === 1 ? "" : "s"}`
      : offsetDays === 0
        ? "is due today"
        : `is now ${offsetDays} day${offsetDays === 1 ? "" : "s"} overdue`;

  return {
    subject: offsetDays > 0 ? `Overdue: Invoice ${invoiceNumber}` : `Reminder: Invoice ${invoiceNumber} ${timing}`,
    html: layout(
      companyName,
      `
      <p>Dear ${escapeHtml(customerName)},</p>
      <p>This is a reminder that invoice <strong>${escapeHtml(invoiceNumber)}</strong> ${timing}.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 0; color: #555;">Amount due</td><td style="text-align: right; font-weight: bold;">${formatCurrency(balanceDue, currency)}</td></tr>
        <tr><td style="padding: 4px 0; color: #555;">Due date</td><td style="text-align: right;">${new Date(dueDate).toLocaleDateString("en-ZA")}</td></tr>
      </table>
      <p>Please arrange payment at your earliest convenience.</p>
      `
    ),
  };
}
