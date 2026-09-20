import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CreditNoteSearchInput } from "@/lib/validations/credit-notes";
import type { Tables } from "@/types/database";

export type CreditNote = Tables<"credit_notes">;
export type CreditNoteItem = Tables<"credit_note_items">;
export type CreditNoteWithCustomer = CreditNote & {
  customers: { company_name: string } | null;
  invoices: { invoice_number: string } | null;
};
export type CreditNoteWithItems = CreditNote & {
  customers: Tables<"customers"> | null;
  invoices: { invoice_number: string } | null;
  credit_note_items: CreditNoteItem[];
};

const PAGE_SIZE = 20;

export interface CreditNoteListPage {
  rows: CreditNoteWithCustomer[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function listCreditNotes(params: CreditNoteSearchInput): Promise<CreditNoteListPage> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("credit_notes")
    .select("*, customers(company_name), invoices(invoice_number)", { count: "exact" })
    .order("credit_note_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.q) {
    const likeEscaped = params.q.replace(/[%_]/g, "\\$&");
    const term = likeEscaped.replace(/["\\]/g, "\\$&");
    query = query.or(`credit_note_number.ilike."%${term}%",reason.ilike."%${term}%"`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error("Unable to load credit notes.");

  return {
    rows: (data ?? []) as CreditNoteWithCustomer[],
    page: params.page,
    pageSize: PAGE_SIZE,
    totalCount: count ?? 0,
  };
}

export async function getCreditNoteById(id: string): Promise<CreditNoteWithItems | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("credit_notes")
    .select("*, customers(*), invoices(invoice_number), credit_note_items(*)")
    .eq("id", id)
    .order("sort_order", { referencedTable: "credit_note_items", ascending: true })
    .maybeSingle();
  return data as CreditNoteWithItems | null;
}

export interface CustomerInvoiceOption {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total: number;
}

/** Any non-cancelled/void invoice for the customer — a credit note can reference a fully-paid invoice too (e.g. a return after payment), not just an outstanding one. */
export async function getCustomerInvoicesForCreditNote(customerId: string): Promise<CustomerInvoiceOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, total")
    .eq("customer_id", customerId)
    .not("status", "in", "(cancelled,void)")
    .order("invoice_date", { ascending: false });
  if (error) throw new Error("Unable to load invoices for this customer.");
  return data ?? [];
}
