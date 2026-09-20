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
