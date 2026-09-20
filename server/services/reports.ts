import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface VatReportRow {
  documentType: "invoice" | "credit_note";
  documentNumber: string;
  documentId: string;
  date: string;
  customerName: string;
  subtotal: number;
  vatAmount: number;
  total: number;
}

export interface VatReportResult {
  periodStart: string;
  periodEnd: string;
  salesExclVat: number;
  outputVat: number;
  creditNotesExclVat: number;
  creditNotesVat: number;
  netVatPayable: number;
  rows: VatReportRow[];
}

/**
 * Output VAT only — on invoice date (accrual basis), not payment date.
 * This app doesn't track expenses/purchases, so there's no input VAT side
 * to net against; this is what a service business hands its accountant
 * for the sales side of a VAT201 submission, not the full return.
 */
export async function getVatReport(periodStart: string, periodEnd: string): Promise<VatReportResult> {
  const supabase = await createSupabaseServerClient();

  const [{ data: invoices }, { data: creditNotes }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, subtotal, vat_total, total, customers(company_name)")
      .gte("invoice_date", periodStart)
      .lte("invoice_date", periodEnd)
      .not("status", "in", "(cancelled,void)")
      .order("invoice_date", { ascending: true }),
    supabase
      .from("credit_notes")
      .select("id, credit_note_number, credit_note_date, subtotal, vat_total, total, customers(company_name)")
      .gte("credit_note_date", periodStart)
      .lte("credit_note_date", periodEnd)
      .eq("status", "issued")
      .order("credit_note_date", { ascending: true }),
  ]);

  const invoiceRows: VatReportRow[] = (invoices ?? []).map((inv) => ({
    documentType: "invoice",
    documentNumber: inv.invoice_number,
    documentId: inv.id,
    date: inv.invoice_date,
    customerName: inv.customers?.company_name ?? "—",
    subtotal: inv.subtotal,
    vatAmount: inv.vat_total,
    total: inv.total,
  }));

  const creditNoteRows: VatReportRow[] = (creditNotes ?? []).map((cn) => ({
    documentType: "credit_note",
    documentNumber: cn.credit_note_number,
    documentId: cn.id,
    date: cn.credit_note_date,
    customerName: cn.customers?.company_name ?? "—",
    subtotal: cn.subtotal,
    vatAmount: cn.vat_total,
    total: cn.total,
  }));

  const rows = [...invoiceRows, ...creditNoteRows].sort((a, b) => a.date.localeCompare(b.date));

  const salesExclVat = invoiceRows.reduce((sum, r) => sum + r.subtotal, 0);
  const outputVat = invoiceRows.reduce((sum, r) => sum + r.vatAmount, 0);
  const creditNotesExclVat = creditNoteRows.reduce((sum, r) => sum + r.subtotal, 0);
  const creditNotesVat = creditNoteRows.reduce((sum, r) => sum + r.vatAmount, 0);

  return {
    periodStart,
    periodEnd,
    salesExclVat,
    outputVat,
    creditNotesExclVat,
    creditNotesVat,
    netVatPayable: outputVat - creditNotesVat,
    rows,
  };
}

export interface AgingRow {
  customerId: string;
  customerName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
}

export interface AgingReportResult {
  asOfDate: string;
  rows: AgingRow[];
  totals: Omit<AgingRow, "customerId" | "customerName">;
}

/**
 * Accounts-receivable aging as of a given date — buckets every outstanding
 * invoice balance by how overdue its due date is. Bucketing/summing is
 * done in SQL (get_aging_report, 0024_...) rather than fetching every
 * outstanding invoice and reducing in JS — see that migration. Per-row
 * totals come straight from the grouped query; the grand-total row is
 * still summed here, but over one row per customer rather than one row
 * per invoice.
 */
export async function getAgingReport(asOfDate: string): Promise<AgingReportResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_aging_report", { p_as_of: asOfDate });
  if (error) throw new Error("Unable to load the aging report.");

  const rows: AgingRow[] = (data ?? []).map((row) => ({
    customerId: row.customer_id,
    customerName: row.customer_name ?? "—",
    current: row.bucket_current,
    days1to30: row.bucket_1_30,
    days31to60: row.bucket_31_60,
    days61to90: row.bucket_61_90,
    days90plus: row.bucket_90_plus,
    total: row.total,
  }));

  const totals = rows.reduce(
    (acc, row) => ({
      current: acc.current + row.current,
      days1to30: acc.days1to30 + row.days1to30,
      days31to60: acc.days31to60 + row.days31to60,
      days61to90: acc.days61to90 + row.days61to90,
      days90plus: acc.days90plus + row.days90plus,
      total: acc.total + row.total,
    }),
    { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 }
  );

  return { asOfDate, rows, totals };
}

export interface SalesReportInvoiceRow {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  subtotal: number;
  vatTotal: number;
  total: number;
}

export interface SalesReportPaymentRow {
  id: string;
  date: string;
  customerName: string;
  paymentMethod: string;
  bankReference: string;
  amount: number;
}

export interface SalesReportResult {
  periodStart: string;
  periodEnd: string;
  invoicedExclVat: number;
  invoicedInclVat: number;
  invoiceCount: number;
  paymentsReceived: number;
  paymentCount: number;
  invoices: SalesReportInvoiceRow[];
  payments: SalesReportPaymentRow[];
}

/**
 * "Sales" and "income" are two different bases over the same period, so
 * this covers both rather than building two near-identical pages:
 * invoiced revenue is accrual (same basis as the VAT report — booked on
 * invoice_date regardless of whether it's been paid), while payments
 * received is cash basis (booked on payment_date regardless of which
 * invoice_date they were allocated against). A business can have sales
 * with no income yet (an unpaid invoice) or income with no new sales
 * (a customer finally paying an old invoice) — showing both side by side
 * makes that visible instead of conflating them into one number.
 */
export async function getSalesReport(periodStart: string, periodEnd: string): Promise<SalesReportResult> {
  const supabase = await createSupabaseServerClient();

  const [{ data: invoices }, { data: payments }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, subtotal, vat_total, total, customers(company_name)")
      .gte("invoice_date", periodStart)
      .lte("invoice_date", periodEnd)
      .not("status", "in", "(cancelled,void)")
      .order("invoice_date", { ascending: true }),
    supabase
      .from("payments")
      .select("id, payment_date, amount, payment_method, bank_reference, customers(company_name)")
      .gte("payment_date", periodStart)
      .lte("payment_date", periodEnd)
      .order("payment_date", { ascending: true }),
  ]);

  const invoiceRows: SalesReportInvoiceRow[] = (invoices ?? []).map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    date: inv.invoice_date,
    customerName: inv.customers?.company_name ?? "—",
    subtotal: inv.subtotal,
    vatTotal: inv.vat_total,
    total: inv.total,
  }));

  const paymentRows: SalesReportPaymentRow[] = (payments ?? []).map((p) => ({
    id: p.id,
    date: p.payment_date,
    customerName: p.customers?.company_name ?? "—",
    paymentMethod: p.payment_method,
    bankReference: p.bank_reference ?? "",
    amount: p.amount,
  }));

  return {
    periodStart,
    periodEnd,
    invoicedExclVat: invoiceRows.reduce((sum, r) => sum + r.subtotal, 0),
    invoicedInclVat: invoiceRows.reduce((sum, r) => sum + r.total, 0),
    invoiceCount: invoiceRows.length,
    paymentsReceived: paymentRows.reduce((sum, r) => sum + r.amount, 0),
    paymentCount: paymentRows.length,
    invoices: invoiceRows,
    payments: paymentRows,
  };
}

export interface BankReconciliationReportRow {
  id: string;
  date: string;
  description: string;
  reference: string;
  amount: number;
  status: "unmatched" | "matched" | "ignored";
  matchedCustomerName: string | null;
}

export interface BankReconciliationReportResult {
  periodStart: string;
  periodEnd: string;
  matchedCount: number;
  matchedAmount: number;
  unmatchedCount: number;
  unmatchedAmount: number;
  ignoredCount: number;
  ignoredAmount: number;
  rows: BankReconciliationReportRow[];
}

/**
 * The live /bank-reconciliation screen is a worklist (all-time counts, no
 * amounts, no date range) — this is the month-end version: how much moved
 * through the bank feed in a given period and how much of it is still
 * unreconciled, by value not just by count.
 */
export async function getBankReconciliationReport(
  periodStart: string,
  periodEnd: string
): Promise<BankReconciliationReportResult> {
  const supabase = await createSupabaseServerClient();

  const { data: transactions } = await supabase
    .from("bank_transactions")
    .select("id, transaction_date, description, reference, amount, status, payments(customers(company_name))")
    .gte("transaction_date", periodStart)
    .lte("transaction_date", periodEnd)
    .order("transaction_date", { ascending: true });

  const rows: BankReconciliationReportRow[] = (transactions ?? []).map((t) => ({
    id: t.id,
    date: t.transaction_date,
    description: t.description,
    reference: t.reference ?? "",
    amount: t.amount,
    status: t.status,
    matchedCustomerName: t.payments?.customers?.company_name ?? null,
  }));

  const byStatus = (status: BankReconciliationReportRow["status"]) => rows.filter((r) => r.status === status);
  const sumAmount = (list: BankReconciliationReportRow[]) => list.reduce((sum, r) => sum + r.amount, 0);

  const matched = byStatus("matched");
  const unmatched = byStatus("unmatched");
  const ignored = byStatus("ignored");

  return {
    periodStart,
    periodEnd,
    matchedCount: matched.length,
    matchedAmount: sumAmount(matched),
    unmatchedCount: unmatched.length,
    unmatchedAmount: sumAmount(unmatched),
    ignoredCount: ignored.length,
    ignoredAmount: sumAmount(ignored),
    rows,
  };
}
