import { describe, expect, it } from "vitest";
import { creditNoteToDocumentData, invoiceToDocumentData, quoteToDocumentData } from "@/lib/pdf/document-data";
import type { InvoiceWithItems } from "@/server/services/invoices";
import type { QuoteWithItems } from "@/server/services/quotes";
import type { CreditNoteWithItems } from "@/server/services/credit-notes";

const customer = {
  company_name: "Acme Co",
  customer_reference: "ACM001",
  contact_person: "Jane Doe",
  address_physical: "1 Main Rd",
  email: "jane@acme.test",
  vat_number: "4123456789",
} as InvoiceWithItems["customers"];

function makeInvoice(overrides: Partial<InvoiceWithItems> = {}): InvoiceWithItems {
  return {
    invoice_number: "INV-000001",
    invoice_date: "2026-01-01",
    due_date: "2026-01-15",
    reference: "",
    status: "draft",
    subtotal: 100,
    discount_total: 0,
    vat_total: 15,
    total: 115,
    amount_paid: 0,
    balance_due: 115,
    notes: "",
    terms: "",
    customers: customer,
    invoice_items: [],
    ...overrides,
  } as InvoiceWithItems;
}

function makeQuote(overrides: Partial<QuoteWithItems> = {}): QuoteWithItems {
  return {
    quote_number: "QUO-000001",
    quote_date: "2026-01-01",
    expiry_date: null,
    reference: "",
    status: "draft",
    subtotal: 100,
    discount_total: 0,
    vat_total: 15,
    total: 115,
    notes: "",
    terms: "",
    customers: customer,
    quote_items: [],
    ...overrides,
  } as QuoteWithItems;
}

function makeCreditNote(overrides: Partial<CreditNoteWithItems> = {}): CreditNoteWithItems {
  return {
    credit_note_number: "CN-000001",
    credit_note_date: "2026-01-01",
    reason: "",
    status: "draft",
    subtotal: 100,
    discount_total: 0,
    vat_total: 15,
    total: 115,
    notes: "",
    terms: "",
    customers: customer,
    credit_note_items: [],
    ...overrides,
  } as CreditNoteWithItems;
}

describe("invoiceToDocumentData", () => {
  it("hides the status badge for draft and sent", () => {
    expect(invoiceToDocumentData(makeInvoice({ status: "draft" })).statusLabel).toBeNull();
    expect(invoiceToDocumentData(makeInvoice({ status: "sent" })).statusLabel).toBeNull();
  });

  it("shows the status badge for paid, partially paid, cancelled, and void", () => {
    expect(invoiceToDocumentData(makeInvoice({ status: "paid" })).statusLabel).toBe("Paid");
    expect(invoiceToDocumentData(makeInvoice({ status: "partially_paid" })).statusLabel).toBe("Partially Paid");
    expect(invoiceToDocumentData(makeInvoice({ status: "cancelled" })).statusLabel).toBe("Cancelled");
    expect(invoiceToDocumentData(makeInvoice({ status: "void" })).statusLabel).toBe("Void");
  });

  it("sets docKind to invoice and carries balance/amount-paid totals", () => {
    const data = invoiceToDocumentData(makeInvoice({ amount_paid: 50, balance_due: 65 }));
    expect(data.docKind).toBe("invoice");
    expect(data.totals.amountPaid).toBe(50);
    expect(data.totals.balanceDue).toBe(65);
  });

  it("only includes a Reference meta field when one is set", () => {
    expect(invoiceToDocumentData(makeInvoice({ reference: "" })).metaFields.some((f) => f.label === "Reference")).toBe(false);
    expect(invoiceToDocumentData(makeInvoice({ reference: "PO-1" })).metaFields.some((f) => f.label === "Reference")).toBe(true);
  });
});

describe("quoteToDocumentData", () => {
  it("hides the status badge for draft, sent, and accepted", () => {
    expect(quoteToDocumentData(makeQuote({ status: "draft" })).statusLabel).toBeNull();
    expect(quoteToDocumentData(makeQuote({ status: "sent" })).statusLabel).toBeNull();
    expect(quoteToDocumentData(makeQuote({ status: "accepted" })).statusLabel).toBeNull();
  });

  it("shows the status badge for rejected, expired, and cancelled", () => {
    expect(quoteToDocumentData(makeQuote({ status: "rejected" })).statusLabel).toBe("Rejected");
    expect(quoteToDocumentData(makeQuote({ status: "expired" })).statusLabel).toBe("Expired");
    expect(quoteToDocumentData(makeQuote({ status: "cancelled" })).statusLabel).toBe("Cancelled");
  });

  it("sets docKind to quote and omits balance/amount-paid totals", () => {
    const data = quoteToDocumentData(makeQuote());
    expect(data.docKind).toBe("quote");
    expect(data.totals.amountPaid).toBeUndefined();
    expect(data.totals.balanceDue).toBeUndefined();
  });

  it("only includes an Expiry date meta field when one is set", () => {
    expect(quoteToDocumentData(makeQuote({ expiry_date: null })).metaFields.some((f) => f.label === "Expiry date")).toBe(false);
    expect(quoteToDocumentData(makeQuote({ expiry_date: "2026-02-01" })).metaFields.some((f) => f.label === "Expiry date")).toBe(true);
  });
});

describe("creditNoteToDocumentData", () => {
  it("hides the status badge for draft only", () => {
    expect(creditNoteToDocumentData(makeCreditNote({ status: "draft" })).statusLabel).toBeNull();
  });

  it("shows the status badge for issued and cancelled", () => {
    expect(creditNoteToDocumentData(makeCreditNote({ status: "issued" })).statusLabel).toBe("Issued");
    expect(creditNoteToDocumentData(makeCreditNote({ status: "cancelled" })).statusLabel).toBe("Cancelled");
  });

  it("sets docKind to credit_note", () => {
    expect(creditNoteToDocumentData(makeCreditNote()).docKind).toBe("credit_note");
  });

  it("only includes a Reason meta field when one is set", () => {
    expect(creditNoteToDocumentData(makeCreditNote({ reason: "" })).metaFields.some((f) => f.label === "Reason")).toBe(false);
    expect(creditNoteToDocumentData(makeCreditNote({ reason: "Returned goods" })).metaFields.some((f) => f.label === "Reason")).toBe(true);
  });
});
