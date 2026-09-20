import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RecurringInvoiceSearchInput } from "@/lib/validations/recurring-invoices";
import type { Tables } from "@/types/database";

export type RecurringInvoice = Tables<"recurring_invoices">;
export type RecurringInvoiceItem = Tables<"recurring_invoice_items">;
export type RecurringInvoiceWithCustomer = RecurringInvoice & { customers: { company_name: string } | null };
export type RecurringInvoiceWithItems = RecurringInvoice & {
  customers: Tables<"customers"> | null;
  recurring_invoice_items: RecurringInvoiceItem[];
};

const PAGE_SIZE = 20;

export interface RecurringInvoiceListPage {
  rows: RecurringInvoiceWithCustomer[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function listRecurringInvoices(params: RecurringInvoiceSearchInput): Promise<RecurringInvoiceListPage> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("recurring_invoices")
    .select("*, customers(company_name)", { count: "exact" })
    .order("next_invoice_date", { ascending: true });

  if (params.status !== "all") query = query.eq("status", params.status);
  if (params.q) {
    const likeEscaped = params.q.replace(/[%_]/g, "\\$&");
    const term = likeEscaped.replace(/["\\]/g, "\\$&");
    query = query.ilike("description", `%${term}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error("Unable to load recurring invoices.");

  return {
    rows: (data ?? []) as RecurringInvoiceWithCustomer[],
    page: params.page,
    pageSize: PAGE_SIZE,
    totalCount: count ?? 0,
  };
}

export async function getRecurringInvoiceById(id: string): Promise<RecurringInvoiceWithItems | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("recurring_invoices")
    .select("*, customers(*), recurring_invoice_items(*)")
    .eq("id", id)
    .order("sort_order", { referencedTable: "recurring_invoice_items", ascending: true })
    .maybeSingle();
  return data as RecurringInvoiceWithItems | null;
}

export interface GeneratedInvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total: number;
  status: string;
}

export async function getGeneratedInvoices(recurringInvoiceId: string): Promise<GeneratedInvoiceRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, total, status")
    .eq("recurring_invoice_id", recurringInvoiceId)
    .order("invoice_date", { ascending: false });
  return data ?? [];
}
