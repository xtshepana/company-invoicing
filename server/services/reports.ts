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

/** Accounts-receivable aging as of a given date — buckets every outstanding invoice balance by how overdue its due date is. */
export async function getAgingReport(asOfDate: string): Promise<AgingReportResult> {
  const supabase = await createSupabaseServerClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("customer_id, due_date, balance_due, customers(company_name)")
    .gt("balance_due", 0)
    .not("status", "in", "(cancelled,void)");

  const asOf = new Date(`${asOfDate}T00:00:00Z`).getTime();
  const byCustomer = new Map<string, AgingRow>();

  for (const inv of invoices ?? []) {
    const daysOverdue = Math.round((asOf - new Date(`${inv.due_date}T00:00:00Z`).getTime()) / 86_400_000);
    const balance = inv.balance_due ?? 0;

    let row = byCustomer.get(inv.customer_id);
    if (!row) {
      row = {
        customerId: inv.customer_id,
        customerName: inv.customers?.company_name ?? "—",
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
        total: 0,
      };
      byCustomer.set(inv.customer_id, row);
    }

    if (daysOverdue <= 0) row.current += balance;
    else if (daysOverdue <= 30) row.days1to30 += balance;
    else if (daysOverdue <= 60) row.days31to60 += balance;
    else if (daysOverdue <= 90) row.days61to90 += balance;
    else row.days90plus += balance;
    row.total += balance;
  }

  const rows = Array.from(byCustomer.values()).sort((a, b) => b.total - a.total);

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
