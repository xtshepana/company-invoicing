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

/** For the dashboard/reports — real aggregate figures, not placeholders. */
export async function getInvoiceSummaryTotals() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("invoices").select("total, amount_paid, balance_due, status, due_date");

  const today = new Date().toISOString().slice(0, 10);
  const rows = data ?? [];

  const totalSales = rows
    .filter((r) => r.status !== "cancelled" && r.status !== "void")
    .reduce((sum, r) => sum + r.total, 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.amount_paid, 0);
  const outstanding = rows
    .filter((r) => r.status !== "cancelled" && r.status !== "void")
    .reduce((sum, r) => sum + (r.balance_due ?? 0), 0);
  const overdue = rows
    .filter((r) => r.status !== "cancelled" && r.status !== "void" && (r.balance_due ?? 0) > 0 && r.due_date < today)
    .reduce((sum, r) => sum + (r.balance_due ?? 0), 0);

  return { totalSales, totalPaid, outstanding, overdue };
}
