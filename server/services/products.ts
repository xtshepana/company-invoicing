import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductSearchInput } from "@/lib/validations/products";
import type { Tables } from "@/types/database";

export type Product = Tables<"products">;

const PAGE_SIZE = 20;

export interface ProductListPage {
  rows: Product[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function listProducts(params: ProductSearchInput): Promise<ProductListPage> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("products").select("*", { count: "exact" });

  if (params.status === "active") query = query.eq("is_active", true);
  if (params.status === "archived") query = query.eq("is_active", false);
  if (params.type !== "all") query = query.eq("type", params.type);

  if (params.q) {
    const likeEscaped = params.q.replace(/[%_]/g, "\\$&");
    const term = likeEscaped.replace(/["\\]/g, "\\$&");
    query = query.or(`name.ilike."%${term}%",sku.ilike."%${term}%",description.ilike."%${term}%"`);
  }

  query = query.order("name", { ascending: true });

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error("Unable to load products.");

  return { rows: data ?? [], page: params.page, pageSize: PAGE_SIZE, totalCount: count ?? 0 };
}

/** For pickers (quote/invoice line item select) — not paginated, active only. */
export async function listAllActiveProducts(): Promise<
  Pick<Product, "id" | "name" | "selling_price" | "vat_rate">[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, selling_price, vat_rate")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error("Unable to load products.");
  return data ?? [];
}

export async function getProductById(id: string): Promise<Product | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  return data;
}
