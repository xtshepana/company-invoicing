import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InvoiceSearchInput } from "@/lib/validations/invoices";
import type { Tables } from "@/types/database";

export type Invoice = Tables<"invoices">;
export type InvoiceItem = Tables<"invoice_items">;
export type InvoiceWithCustomer = Invoice & { customers: { company_name: string } | null };
export type InvoiceWithItems = Invoice & {
  customers: Tables<"customers"> | null;
  invoice_items: InvoiceItem[];
};

const PAGE_SIZE = 20;

export interface InvoiceListPage {
  rows: InvoiceWithCustomer[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function listInvoices(params: InvoiceSearchInput): Promise<InvoiceListPage> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("invoices")
    .select("*, customers(company_name)", { count: "exact" })
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params.status === "overdue") {
    const today = new Date().toISOString().slice(0, 10);
    query = query.lt("due_date", today).gt("balance_due", 0).not("status", "in", "(cancelled,void)");
  } else if (params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.q) {
    const likeEscaped = params.q.replace(/[%_]/g, "\\$&");
    const term = likeEscaped.replace(/["\\]/g, "\\$&");
    query = query.or(`invoice_number.ilike."%${term}%",reference.ilike."%${term}%"`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error("Unable to load invoices.");

  return { rows: (data ?? []) as InvoiceWithCustomer[], page: params.page, pageSize: PAGE_SIZE, totalCount: count ?? 0 };
}

export async function getInvoiceById(id: string): Promise<InvoiceWithItems | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("*, customers(*), invoice_items(*)")
    .eq("id", id)
    .order("sort_order", { referencedTable: "invoice_items", ascending: true })
    .maybeSingle();
  return data as InvoiceWithItems | null;
}

export interface CustomerInvoiceSummary {
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  recentInvoices: Pick<Invoice, "id" | "invoice_number" | "invoice_date" | "total" | "balance_due" | "status">[];
}

export async function getCustomerInvoiceSummary(customerId: string): Promise<CustomerInvoiceSummary> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, total, balance_due, amount_paid, status")
    .eq("customer_id", customerId)
    .order("invoice_date", { ascending: false });

  const rows = data ?? [];
  const active = rows.filter((r) => r.status !== "cancelled" && r.status !== "void");

  return {
    totalInvoiced: active.reduce((sum, r) => sum + r.total, 0),
    totalPaid: active.reduce((sum, r) => sum + r.amount_paid, 0),
    outstanding: active.reduce((sum, r) => sum + (r.balance_due ?? 0), 0),
    recentInvoices: rows.slice(0, 5),
  };
}

/**
 * For the dashboard/reports — real aggregate figures, not placeholders.
 * Computed in SQL (get_invoice_summary_totals, 0023_...) rather than
 * pulling every invoice row into JS to reduce — see that migration.
 */
export async function getInvoiceSummaryTotals() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_invoice_summary_totals").single();
  if (error || !data) throw new Error("Unable to load invoice summary totals.");

  return {
    totalSales: data.total_sales,
    totalPaid: data.total_paid,
    outstanding: data.outstanding,
    overdue: data.overdue,
  };
}

export interface InvoiceCountStats {
  unpaidCount: number;
  overdueCount: number;
  invoicedThisMonth: number;
}

function currentMonthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * For the dashboard — counts only (`{count: "exact", head: true}`, no rows
 * fetched), plus "invoiced this month" which is naturally bounded to one
 * month's rows rather than an all-time reduce.
 */
export async function getInvoiceCountStats(): Promise<InvoiceCountStats> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = currentMonthStart();

  const [{ count: unpaidCount }, { count: overdueCount }, { data: monthInvoices }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .gt("balance_due", 0)
      .not("status", "in", "(cancelled,void)"),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .gt("balance_due", 0)
      .lt("due_date", today)
      .not("status", "in", "(cancelled,void)"),
    supabase.from("invoices").select("total").gte("invoice_date", monthStart).not("status", "in", "(cancelled,void)"),
  ]);

  return {
    unpaidCount: unpaidCount ?? 0,
    overdueCount: overdueCount ?? 0,
    invoicedThisMonth: (monthInvoices ?? []).reduce((sum, r) => sum + r.total, 0),
  };
}

export interface RecentInvoiceItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  status: Invoice["status"];
  invoiceDate: string;
}

/** For the dashboard's "recent invoices" list. */
export async function getRecentInvoices(limit: number): Promise<RecentInvoiceItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, status, invoice_date, customers(company_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    customerName: inv.customers?.company_name ?? "—",
    total: inv.total,
    status: inv.status,
    invoiceDate: inv.invoice_date,
  }));
}
