import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ExpenseSearchInput } from "@/lib/validations/suppliers";
import type { Tables } from "@/types/database";

export type Expense = Tables<"expenses">;
export type ExpenseWithSupplier = Expense & { suppliers: { company_name: string } | null };

const PAGE_SIZE = 20;

export interface ExpenseListPage {
  rows: ExpenseWithSupplier[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function listExpenses(params: ExpenseSearchInput): Promise<ExpenseListPage> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("expenses").select("*, suppliers(company_name)", { count: "exact" });

  if (params.q) {
    const likeEscaped = params.q.replace(/[%_]/g, "\\$&");
    const term = likeEscaped.replace(/["\\]/g, "\\$&");
    query = query.or(`description.ilike."%${term}%",category.ilike."%${term}%"`);
  }

  switch (params.sort) {
    case "date_asc":
      query = query.order("expense_date", { ascending: true });
      break;
    case "amount_desc":
      query = query.order("amount", { ascending: false });
      break;
    case "amount_asc":
      query = query.order("amount", { ascending: true });
      break;
    default:
      query = query.order("expense_date", { ascending: false });
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error("Unable to load expenses.");

  return { rows: (data ?? []) as ExpenseWithSupplier[], page: params.page, pageSize: PAGE_SIZE, totalCount: count ?? 0 };
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("expenses").select("*").eq("id", id).maybeSingle();
  return data;
}

/** For the dashboard — a sum, not a fetch, so it doesn't grow with the expense list. */
export async function getExpensesThisMonth(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { data } = await supabase.from("expenses").select("amount").gte("expense_date", monthStart);
  return (data ?? []).reduce((sum, r) => sum + r.amount, 0);
}
