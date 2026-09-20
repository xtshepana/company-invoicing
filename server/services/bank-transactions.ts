import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BankTransactionSearchInput } from "@/lib/validations/bank-transactions";
import type { Tables } from "@/types/database";

export type BankTransaction = Tables<"bank_transactions">;
export type BankImportBatch = Tables<"bank_import_batches">;
export type BankTransactionWithPayment = BankTransaction & {
  payments: { id: string; amount: number; payment_date: string; customers: { company_name: string } | null } | null;
};

export interface CandidatePayment {
  id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  bank_reference: string;
  description: string;
  customers: { company_name: string } | null;
  amountMatches: boolean;
  daysApart: number;
}

const PAGE_SIZE = 25;

export interface BankTransactionListPage {
  rows: BankTransactionWithPayment[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function listBankTransactions(params: BankTransactionSearchInput): Promise<BankTransactionListPage> {
  const supabase = await createSupabaseServerClient();
  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("bank_transactions")
    .select("*, payments(id, amount, payment_date, customers(company_name))", { count: "exact" })
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.q) {
    const likeEscaped = params.q.replace(/[%_]/g, "\\$&");
    const term = likeEscaped.replace(/["\\]/g, "\\$&");
    query = query.or(`description.ilike."%${term}%",reference.ilike."%${term}%"`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error("Unable to load bank transactions.");

  return {
    rows: (data ?? []) as BankTransactionWithPayment[],
    page: params.page,
    pageSize: PAGE_SIZE,
    totalCount: count ?? 0,
  };
}

export async function getBankTransactionById(id: string): Promise<BankTransactionWithPayment | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("bank_transactions")
    .select("*, payments(id, amount, payment_date, customers(company_name))")
    .eq("id", id)
    .maybeSingle();
  return (data as BankTransactionWithPayment | null) ?? null;
}

export interface ReconciliationStats {
  unmatched: number;
  matched: number;
  ignored: number;
}

export async function getReconciliationStats(): Promise<ReconciliationStats> {
  const supabase = await createSupabaseServerClient();
  const [unmatched, matched, ignored] = await Promise.all([
    supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("status", "unmatched"),
    supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("status", "matched"),
    supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("status", "ignored"),
  ]);

  return {
    unmatched: unmatched.count ?? 0,
    matched: matched.count ?? 0,
    ignored: ignored.count ?? 0,
  };
}

export async function listImportBatches(): Promise<BankImportBatch[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("bank_import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

/**
 * Candidate payments for manually matching one bank transaction: excludes
 * payments already claimed by another transaction, ranks exact-amount
 * matches first and otherwise by closeness in date. Recent-payments-only
 * (a bounded scan) is intentional — this is a small-company ledger, not a
 * high-volume one, so a full unbounded query is not worth the complexity.
 */
export async function listCandidatePayments(amount: number, transactionDate: string): Promise<CandidatePayment[]> {
  const supabase = await createSupabaseServerClient();

  const [{ data: payments }, { data: matchedRows }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, customer_id, amount, payment_date, bank_reference, description, customers(company_name)")
      .order("payment_date", { ascending: false })
      .limit(300),
    supabase.from("bank_transactions").select("matched_payment_id").not("matched_payment_id", "is", null),
  ]);

  const matchedIds = new Set((matchedRows ?? []).map((row) => row.matched_payment_id));
  const targetDate = new Date(`${transactionDate}T00:00:00Z`).getTime();

  return (payments ?? [])
    .filter((payment) => !matchedIds.has(payment.id))
    .map((payment) => ({
      ...payment,
      amountMatches: Math.abs(payment.amount - amount) < 0.005,
      daysApart: Math.abs(new Date(`${payment.payment_date}T00:00:00Z`).getTime() - targetDate) / 86_400_000,
    }))
    .sort((a, b) => {
      if (a.amountMatches !== b.amountMatches) return a.amountMatches ? -1 : 1;
      return a.daysApart - b.daysApart;
    })
    .slice(0, 50);
}
