import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentSearchInput } from "@/lib/validations/payments";
import type { Tables } from "@/types/database";

export type Payment = Tables<"payments">;
export type PaymentAllocation = Tables<"payment_allocations">;
export type CustomerCredit = Tables<"customer_credits">;

export type PaymentWithCustomer = Payment & { customers: { company_name: string } | null };
export type PaymentWithDetails = Payment & {
  customers: Tables<"customers"> | null;
  payment_allocations: (PaymentAllocation & { invoices: { invoice_number: string } | null })[];
};

const PAGE_SIZE = 20;

export interface PaymentListPage {
  rows: PaymentWithCustomer[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function listPayments(params: PaymentSearchInput): Promise<PaymentListPage> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("payments")
    .select("*, customers(company_name)", { count: "exact" })
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params.q) {
    const likeEscaped = params.q.replace(/[%_]/g, "\\$&");
    const term = likeEscaped.replace(/["\\]/g, "\\$&");
    query = query.or(`bank_reference.ilike."%${term}%",description.ilike."%${term}%"`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error("Unable to load payments.");

  return { rows: (data ?? []) as PaymentWithCustomer[], page: params.page, pageSize: PAGE_SIZE, totalCount: count ?? 0 };
}

export async function getPaymentById(id: string): Promise<PaymentWithDetails | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("payments")
    .select("*, customers(*), payment_allocations(*, invoices(invoice_number))")
    .eq("id", id)
    .maybeSingle();
  return data as PaymentWithDetails | null;
}

export interface OutstandingInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  balance_due: number;
}

/** For the payment-allocation picker — unpaid invoices for one customer, oldest due first. */
export async function getCustomerOutstandingInvoices(customerId: string): Promise<OutstandingInvoice[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, due_date, total, balance_due")
    .eq("customer_id", customerId)
    .gt("balance_due", 0)
    .not("status", "in", "(cancelled,void)")
    .order("due_date", { ascending: true });
  if (error) throw new Error("Unable to load outstanding invoices.");
  return (data ?? []) as OutstandingInvoice[];
}

export async function getCustomerRecentPayments(customerId: string, limit = 5): Promise<Payment[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("customer_id", customerId)
    .order("payment_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getCustomerCreditBalance(customerId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("customer_credits").select("amount").eq("customer_id", customerId);
  return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
}

export async function getCustomerCreditLedger(customerId: string): Promise<CustomerCredit[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customer_credits")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export interface InvoicePaymentEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  kind: "payment" | "credit";
}

/** Every payment allocation and credit application for one invoice, newest first. */
export async function getInvoicePaymentHistory(invoiceId: string): Promise<InvoicePaymentEntry[]> {
  const supabase = await createSupabaseServerClient();

  const [{ data: allocations }, { data: credits }] = await Promise.all([
    supabase
      .from("payment_allocations")
      .select("id, amount, created_at, payments(payment_date, payment_method, bank_reference)")
      .eq("invoice_id", invoiceId),
    supabase
      .from("customer_credits")
      .select("id, amount, created_at, notes")
      .eq("invoice_id", invoiceId)
      .eq("source", "applied_to_invoice"),
  ]);

  const paymentEntries: InvoicePaymentEntry[] = (allocations ?? []).map((row) => {
    const payment = row.payments as { payment_date: string; payment_method: string; bank_reference: string } | null;
    return {
      id: row.id,
      date: payment?.payment_date ?? row.created_at,
      description: `${payment?.payment_method ?? "Payment"}${payment?.bank_reference ? ` · ${payment.bank_reference}` : ""}`,
      amount: row.amount,
      kind: "payment",
    };
  });

  const creditEntries: InvoicePaymentEntry[] = (credits ?? []).map((row) => ({
    id: row.id,
    date: row.created_at,
    description: row.notes || "Customer credit applied",
    amount: -row.amount, // stored negative (consumed); display as a positive payment-like amount
    kind: "credit",
  }));

  return [...paymentEntries, ...creditEntries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

function currentMonthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** For the dashboard — cash received this month, naturally bounded to one month's rows. */
export async function getPaidThisMonth(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("payments").select("amount").gte("payment_date", currentMonthStart());
  return (data ?? []).reduce((sum, r) => sum + r.amount, 0);
}

export interface RecentPaymentItem {
  id: string;
  customerName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
}

/** For the dashboard's "recent payments" list. */
export async function getRecentPayments(limit: number): Promise<RecentPaymentItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("payments")
    .select("id, amount, payment_date, payment_method, customers(company_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((p) => ({
    id: p.id,
    customerName: p.customers?.company_name ?? "—",
    amount: p.amount,
    paymentDate: p.payment_date,
    paymentMethod: p.payment_method,
  }));
}
