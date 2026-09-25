import type { InvoiceWithItems } from "@/server/services/invoices";
import type { QuoteWithItems } from "@/server/services/quotes";
import type { CreditNoteWithItems } from "@/server/services/credit-notes";
import type { Tables } from "@/types/database";

/**
 * Normalized shape every PDF template renders from, so a template is
 * written once and works for invoices, quotes, and credit notes alike
 * instead of needing three near-duplicate implementations. The adapters
 * below are the only place that know about each document type's actual
 * field names/status set - see lib/pdf/templates/*.tsx for the templates
 * themselves.
 */
export interface DocumentLine {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  lineTotal: number;
}

export interface DocumentMetaField {
  label: string;
  value: string;
}

export interface DocumentCustomer {
  name: string;
  accountNo: string;
  contactPerson: string;
  address: string;
  email: string;
  vatNumber: string;
}

export interface DocumentTotals {
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
}

export interface DocumentData {
  docKind: "invoice" | "quote" | "credit_note";
  docTitle: string;
  number: string;
  statusLabel: string | null;
  metaFields: DocumentMetaField[];
  billToLabel: string;
  customer: DocumentCustomer;
  lineItems: DocumentLine[];
  totals: DocumentTotals;
  notes: string;
  terms: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function customerFrom(customer: Tables<"customers"> | null): DocumentCustomer {
  return {
    name: customer?.company_name ?? "",
    accountNo: customer?.customer_reference ?? "",
    contactPerson: customer?.contact_person ?? "",
    address: customer?.address_physical ?? "",
    email: customer?.email ?? "",
    vatNumber: customer?.vat_number ?? "",
  };
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  cancelled: "Cancelled",
  void: "Void",
};
// Draft/sent are internal workflow states with nothing useful to tell a
// customer looking at the PDF - only show the badge once there's something
// worth flagging (paid, partially paid, cancelled, void).
const INVOICE_HIDDEN_STATUSES = new Set(["draft", "sent"]);

export function invoiceToDocumentData(invoice: InvoiceWithItems): DocumentData {
  const metaFields: DocumentMetaField[] = [
    { label: "Invoice number", value: invoice.invoice_number },
    { label: "Invoice date", value: formatDate(invoice.invoice_date) },
    { label: "Due date", value: formatDate(invoice.due_date) },
  ];
  if (invoice.reference) metaFields.push({ label: "Reference", value: invoice.reference });

  return {
    docKind: "invoice",
    docTitle: "INVOICE",
    number: invoice.invoice_number,
    statusLabel: INVOICE_HIDDEN_STATUSES.has(invoice.status) ? null : (INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status),
    metaFields,
    billToLabel: "Bill To",
    customer: customerFrom(invoice.customers),
    lineItems: invoice.invoice_items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountPercent: item.discount_percent,
      vatRate: item.vat_rate,
      lineTotal: item.line_total,
    })),
    totals: {
      subtotal: invoice.subtotal,
      discount: invoice.discount_total,
      vat: invoice.vat_total,
      total: invoice.total,
      amountPaid: invoice.amount_paid,
      balanceDue: invoice.balance_due ?? 0,
    },
    notes: invoice.notes,
    terms: invoice.terms,
  };
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};
// Draft/sent/accepted are internal workflow states with nothing useful to
// tell a customer looking at the PDF - only show the badge once there's
// something worth flagging (rejected, expired, cancelled).
const QUOTE_HIDDEN_STATUSES = new Set(["draft", "sent", "accepted"]);

export function quoteToDocumentData(quote: QuoteWithItems): DocumentData {
  const metaFields: DocumentMetaField[] = [
    { label: "Quote number", value: quote.quote_number },
    { label: "Quote date", value: formatDate(quote.quote_date) },
  ];
  if (quote.expiry_date) metaFields.push({ label: "Expiry date", value: formatDate(quote.expiry_date) });
  if (quote.reference) metaFields.push({ label: "Reference", value: quote.reference });

  return {
    docKind: "quote",
    docTitle: "QUOTATION",
    number: quote.quote_number,
    statusLabel: QUOTE_HIDDEN_STATUSES.has(quote.status) ? null : (QUOTE_STATUS_LABELS[quote.status] ?? quote.status),
    metaFields,
    billToLabel: "Quoted To",
    customer: customerFrom(quote.customers),
    lineItems: quote.quote_items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountPercent: item.discount_percent,
      vatRate: item.vat_rate,
      lineTotal: item.line_total,
    })),
    totals: {
      subtotal: quote.subtotal,
      discount: quote.discount_total,
      vat: quote.vat_total,
      total: quote.total,
    },
    notes: quote.notes,
    terms: quote.terms,
  };
}

const CREDIT_NOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  cancelled: "Cancelled",
};
// Draft is an internal workflow state with nothing useful to tell a
// customer looking at the PDF - only show the badge once there's something
// worth flagging (issued, cancelled).
const CREDIT_NOTE_HIDDEN_STATUSES = new Set(["draft"]);

export function creditNoteToDocumentData(creditNote: CreditNoteWithItems): DocumentData {
  const metaFields: DocumentMetaField[] = [
    { label: "Credit note number", value: creditNote.credit_note_number },
    { label: "Date", value: formatDate(creditNote.credit_note_date) },
  ];
  if (creditNote.reason) metaFields.push({ label: "Reason", value: creditNote.reason });

  return {
    docKind: "credit_note",
    docTitle: "CREDIT NOTE",
    number: creditNote.credit_note_number,
    statusLabel: CREDIT_NOTE_HIDDEN_STATUSES.has(creditNote.status)
      ? null
      : (CREDIT_NOTE_STATUS_LABELS[creditNote.status] ?? creditNote.status),
    metaFields,
    billToLabel: "Credit To",
    customer: customerFrom(creditNote.customers),
    lineItems: creditNote.credit_note_items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountPercent: item.discount_percent,
      vatRate: item.vat_rate,
      lineTotal: item.line_total,
    })),
    totals: {
      subtotal: creditNote.subtotal,
      discount: creditNote.discount_total,
      vat: creditNote.vat_total,
      total: creditNote.total,
    },
    notes: creditNote.notes,
    terms: creditNote.terms,
  };
}
