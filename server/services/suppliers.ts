import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupplierSearchInput } from "@/lib/validations/suppliers";
import type { Tables } from "@/types/database";

export type Supplier = Tables<"suppliers">;

const PAGE_SIZE = 20;

export interface SupplierListPage {
  rows: Supplier[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** Server-side search/filter/sort/paginate — same pattern as listCustomers. */
export async function listSuppliers(params: SupplierSearchInput): Promise<SupplierListPage> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("suppliers").select("*", { count: "exact" });

  if (params.status === "active") query = query.eq("is_active", true);
  if (params.status === "archived") query = query.eq("is_active", false);

  if (params.q) {
    const likeEscaped = params.q.replace(/[%_]/g, "\\$&");
    const term = likeEscaped.replace(/["\\]/g, "\\$&");
    query = query.or(
      `company_name.ilike."%${term}%",contact_person.ilike."%${term}%",email.ilike."%${term}%",phone.ilike."%${term}%"`
    );
  }

  switch (params.sort) {
    case "name_desc":
      query = query.order("company_name", { ascending: false });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    default:
      query = query.order("company_name", { ascending: true });
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error("Unable to load suppliers.");

  return { rows: data ?? [], page: params.page, pageSize: PAGE_SIZE, totalCount: count ?? 0 };
}

export async function listAllActiveSuppliers(): Promise<Pick<Supplier, "id" | "company_name">[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, company_name")
    .eq("is_active", true)
    .order("company_name", { ascending: true });
  if (error) throw new Error("Unable to load suppliers.");
  return data ?? [];
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle();
  return data;
}

export interface SupplierRecentExpense {
  id: string;
  expenseDate: string;
  description: string;
  category: string;
  amount: number;
}

/** For the supplier detail page. */
export async function getSupplierRecentExpenses(supplierId: string, limit = 5): Promise<SupplierRecentExpense[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("expenses")
    .select("id, expense_date, description, category, amount")
    .eq("supplier_id", supplierId)
    .order("expense_date", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    expenseDate: row.expense_date,
    description: row.description,
    category: row.category,
    amount: row.amount,
  }));
}
