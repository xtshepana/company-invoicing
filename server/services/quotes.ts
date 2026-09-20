import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuoteSearchInput } from "@/lib/validations/quotes";
import type { Tables } from "@/types/database";

export type Quote = Tables<"quotes">;
export type QuoteItem = Tables<"quote_items">;
export type QuoteWithCustomer = Quote & { customers: { company_name: string } | null };
export type QuoteWithItems = Quote & {
  customers: Tables<"customers"> | null;
  quote_items: QuoteItem[];
};

const PAGE_SIZE = 20;

export interface QuoteListPage {
  rows: QuoteWithCustomer[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function listQuotes(params: QuoteSearchInput): Promise<QuoteListPage> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("quotes")
    .select("*, customers(company_name)", { count: "exact" })
    .order("quote_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params.status !== "all") query = query.eq("status", params.status);
  if (params.q) {
    const likeEscaped = params.q.replace(/[%_]/g, "\\$&");
    const term = likeEscaped.replace(/["\\]/g, "\\$&");
    query = query.or(`quote_number.ilike."%${term}%",reference.ilike."%${term}%"`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error("Unable to load quotes.");

  return { rows: (data ?? []) as QuoteWithCustomer[], page: params.page, pageSize: PAGE_SIZE, totalCount: count ?? 0 };
}

export async function getQuoteById(id: string): Promise<QuoteWithItems | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("quotes")
    .select("*, customers(*), quote_items(*)")
    .eq("id", id)
    .order("sort_order", { referencedTable: "quote_items", ascending: true })
    .maybeSingle();
  return data as QuoteWithItems | null;
}
