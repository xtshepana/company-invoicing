import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCompanySettings } from "@/lib/config/system-settings";
import { toDbNumeric } from "@/lib/money";
import { recurringInvoiceAmount, summarizeRecurring, type RecurringSummary } from "@/lib/recurring-totals";
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

/** A list row with what one generated invoice comes to (decimal string), worked out from its line items. */
export type RecurringInvoiceListRow = RecurringInvoiceWithCustomer & { amount: string };

/** Just the columns that decide a line's price - all the list needs from the items. */
const PRICE_COLUMNS = "quantity, unit_price, discount_percent, vat_rate";

type RowWithLines = RecurringInvoice & {
  customers?: { company_name: string } | null;
  recurring_invoice_items: Pick<RecurringInvoiceItem, "quantity" | "unit_price" | "discount_percent" | "vat_rate">[];
};

export interface RecurringInvoiceListPage {
  rows: RecurringInvoiceListRow[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function listRecurringInvoices(params: RecurringInvoiceSearchInput): Promise<RecurringInvoiceListPage> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const query = applyFilters(
    supabase
      .from("recurring_invoices")
      .select(`*, customers(company_name), recurring_invoice_items(${PRICE_COLUMNS})`, { count: "exact" })
      .order("next_invoice_date", { ascending: true }),
    params
  );

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error("Unable to load recurring invoices.");

  const { vat_registered: vatRegistered } = await getCompanySettings();
  const rows = ((data ?? []) as unknown as RowWithLines[]).map(({ recurring_invoice_items: lines, ...row }) => ({
    ...row,
    customers: row.customers ?? null,
    amount: toDbNumeric(recurringInvoiceAmount(lines ?? [], row.prices_include_vat, vatRegistered)),
  }));

  return { rows, page: params.page, pageSize: PAGE_SIZE, totalCount: count ?? 0 };
}

/** The status / search filters shared by the page of rows and the all-clients total, so the two always agree. */
function applyFilters<T extends { eq: (column: string, value: string) => T; ilike: (column: string, pattern: string) => T }>(
  query: T,
  params: RecurringInvoiceSearchInput
): T {
  let filtered = query;
  if (params.status !== "all") filtered = filtered.eq("status", params.status);
  if (params.q) {
    const likeEscaped = params.q.replace(/[%_]/g, "\\$&");
    const term = likeEscaped.replace(/["\\]/g, "\\$&");
    filtered = filtered.ilike("description", `%${term}%`);
  }
  return filtered;
}

const SUMMARY_BATCH = 1000; // PostgREST returns at most 1000 rows a request, so the total is built from batches.

/**
 * The total across ALL clients that match the filters - not just the 20 on the page being viewed. Each recurring
 * invoice is priced exactly as the daily job will bill it, then everything is added up as a monthly figure.
 */
export async function getRecurringSummary(params: RecurringInvoiceSearchInput): Promise<RecurringSummary> {
  const supabase = await createSupabaseServerClient();
  const { vat_registered: vatRegistered } = await getCompanySettings();
  const inputs: Parameters<typeof summarizeRecurring>[0] = [];

  for (let offset = 0; ; offset += SUMMARY_BATCH) {
    const query = applyFilters(
      supabase
        .from("recurring_invoices")
        .select(`id, customer_id, frequency, custom_interval_days, prices_include_vat, recurring_invoice_items(${PRICE_COLUMNS})`)
        .order("id", { ascending: true }),
      params
    );
    const { data, error } = await query.range(offset, offset + SUMMARY_BATCH - 1);
    if (error) throw new Error("Unable to load the recurring invoice total.");

    const batch = (data ?? []) as unknown as (Pick<RecurringInvoice, "customer_id" | "frequency" | "custom_interval_days" | "prices_include_vat"> & {
      recurring_invoice_items: RowWithLines["recurring_invoice_items"];
    })[];
    for (const row of batch) {
      inputs.push({
        customer_id: row.customer_id,
        frequency: row.frequency,
        custom_interval_days: row.custom_interval_days,
        amount: recurringInvoiceAmount(row.recurring_invoice_items ?? [], row.prices_include_vat, vatRegistered),
      });
    }
    if (batch.length < SUMMARY_BATCH) break;
  }

  return summarizeRecurring(inputs);
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
