import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateCustomerReferenceCandidate } from "@/lib/customer-reference";
import type { CustomerSearchInput } from "@/lib/validations/customers";
import type { Tables } from "@/types/database";

export type Customer = Tables<"customers">;

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Auto-generates a customer_reference (3 letters from the company name + 5
 * random digits) and checks it against the unique index
 * (customers_customer_reference_unique) before returning it, so callers
 * essentially never hit that constraint on insert - a handful of random
 * digits colliding for the same 3-letter prefix is already rare, this just
 * closes the remaining gap. The unique index itself is what actually
 * guarantees no duplicate ever gets persisted, including under concurrent
 * requests this check alone can't rule out.
 */
export async function generateUniqueCustomerReference(
  supabase: SupabaseClient,
  companyName: string
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCustomerReferenceCandidate(companyName);
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("customer_reference", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("Unable to generate a unique customer reference. Please try again.");
}

const PAGE_SIZE = 20;

export interface CustomerListPage {
  rows: Customer[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** Server-side search/filter/sort/paginate — never load the full customer list into the browser. */
export async function listCustomers(params: CustomerSearchInput): Promise<CustomerListPage> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("customers").select("*", { count: "exact" });

  if (params.status === "active") query = query.eq("is_active", true);
  if (params.status === "archived") query = query.eq("is_active", false);

  if (params.q) {
    // Escape ILIKE wildcards, then double-quote the value per PostgREST's
    // filter syntax so a term containing `,` or `()` can't be parsed as
    // extra filter clauses (escaping only %/_ is not enough on its own).
    const likeEscaped = params.q.replace(/[%_]/g, "\\$&");
    const term = likeEscaped.replace(/["\\]/g, "\\$&");
    query = query.or(
      `company_name.ilike."%${term}%",contact_person.ilike."%${term}%",email.ilike."%${term}%",phone.ilike."%${term}%",customer_reference.ilike."%${term}%"`
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
  if (error) throw new Error("Unable to load customers.");

  return { rows: data ?? [], page: params.page, pageSize: PAGE_SIZE, totalCount: count ?? 0 };
}

/** For pickers (quote/invoice customer select) — not paginated, active only. */
export async function listAllActiveCustomers(): Promise<Pick<Customer, "id" | "company_name">[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, company_name")
    .eq("is_active", true)
    .order("company_name", { ascending: true });
  if (error) throw new Error("Unable to load customers.");
  return data ?? [];
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  return data;
}

/** For the dashboard — a count, not a fetch, so it doesn't grow with the customer list. */
export async function getActiveCustomerCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true);
  return count ?? 0;
}
