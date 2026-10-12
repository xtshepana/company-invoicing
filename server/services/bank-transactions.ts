import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findQuotedAccountNumbers, genericNameWords, nameAppearsIn } from "@/lib/customers/account-number";
import type { BankTransactionSearchInput } from "@/lib/validations/bank-transactions";
import type { Tables } from "@/types/database";

export type BankTransaction = Tables<"bank_transactions">;
export type BankImportBatch = Tables<"bank_import_batches">;
export type BankTransactionWithPayment = BankTransaction & {
  payments: { id: string; amount: number; payment_date: string; customers: { company_name: string } | null } | null;
};

/**
 * How sure the suggestion is, for staff to weigh before accepting a
 * match — never used to auto-apply anything beyond what
 * auto_match_bank_transactions already does. HIGH means multiple
 * independent signals agree (or the two signals that matter most for
 * that candidate type); MEDIUM means exactly one; LOW means the
 * candidate is only shown for completeness and shouldn't be trusted
 * without checking.
 */
export type MatchConfidence = "high" | "medium" | "low";

/**
 * Amount is the primary signal — auto_match_bank_transactions itself
 * never links on anything but an exact amount, so a candidate payment
 * whose amount doesn't match is only ever a low-confidence, speculative
 * suggestion regardless of how close the dates are. Pulled out as a pure
 * function so the tiering rule is directly unit-testable without needing
 * a database.
 */
export function computePaymentMatchConfidence(amountMatches: boolean, daysApart: number): MatchConfidence {
  if (!amountMatches) return "low";
  return daysApart <= 3 ? "high" : "medium";
}

/**
 * The payer quoting the customer's account number is the strongest sign of who paid (it is the Payment Reference
 * printed on the invoice); the amount agreeing as well makes it a near-certain match. Amount + name agreeing is the
 * best case without an account number; exactly one signal is a reasonable lead worth checking.
 * `listCandidateInvoices` only ever returns rows where at least one signal is true, so "low" doesn't occur in practice
 * there — kept as a real case here for a consistent type with computePaymentMatchConfidence.
 */
export function computeInvoiceMatchConfidence(
  amountMatches: boolean,
  nameMatches: boolean,
  accountMatches = false
): MatchConfidence {
  if (amountMatches && (nameMatches || accountMatches)) return "high";
  if (amountMatches || nameMatches || accountMatches) return "medium";
  return "low";
}

export interface CandidatePayment {
  id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  bank_reference: string;
  description: string;
  customers: { company_name: string; customer_reference: string | null } | null;
  amountMatches: boolean;
  daysApart: number;
  confidence: MatchConfidence;
}

export interface CandidateInvoice {
  id: string;
  customer_id: string;
  invoice_number: string;
  due_date: string;
  total: number;
  balance_due: number;
  customers: { company_name: string; customer_reference: string | null } | null;
  amountMatches: boolean;
  nameMatches: boolean;
  /** The bank line quotes this customer's account number. */
  accountMatches: boolean;
  confidence: MatchConfidence;
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
      .select("id, customer_id, amount, payment_date, bank_reference, description, customers(company_name, customer_reference)")
      .order("payment_date", { ascending: false })
      .limit(300),
    supabase.from("bank_transactions").select("matched_payment_id").not("matched_payment_id", "is", null),
  ]);

  const matchedIds = new Set((matchedRows ?? []).map((row) => row.matched_payment_id));
  const targetDate = new Date(`${transactionDate}T00:00:00Z`).getTime();

  return (payments ?? [])
    .filter((payment) => !matchedIds.has(payment.id))
    .map((payment) => {
      const amountMatches = Math.abs(payment.amount - amount) < 0.005;
      const daysApart = Math.abs(new Date(`${payment.payment_date}T00:00:00Z`).getTime() - targetDate) / 86_400_000;
      const confidence = computePaymentMatchConfidence(amountMatches, daysApart);
      return { ...payment, amountMatches, daysApart, confidence };
    })
    .sort((a, b) => {
      if (a.amountMatches !== b.amountMatches) return a.amountMatches ? -1 : 1;
      return a.daysApart - b.daysApart;
    })
    .slice(0, 50);
}

/**
 * Candidate invoices for a bank transaction that has no matching payment yet
 * — this is the "beyond auto_match_bank_transactions" gap: that function
 * only ever links to a payment that already exists, so a transaction that
 * arrived before anyone captured the payment has nothing to auto-match
 * against. Never creates or links anything itself.
 *
 * Who paid is decided in this order, so customers aren't mixed up:
 * 1. If the bank line quotes a customer's account number (the Payment Reference on the invoice), only that
 *    customer's outstanding invoices are suggested - names and amounts of other customers are not considered.
 * 2. Otherwise, outstanding invoices whose balance equals the amount and/or whose customer name shows up in the
 *    description/reference. Words that appear in many customers' names ("attorneys") are ignored for the name check,
 *    since they identify none of them.
 */
export async function listCandidateInvoices(
  amount: number,
  description: string,
  reference: string | null,
): Promise<CandidateInvoice[]> {
  if (amount <= 0) return [];
  const supabase = await createSupabaseServerClient();
  const haystack = `${description} ${reference ?? ""}`;

  const [{ data: invoices }, { data: customerRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, customer_id, invoice_number, due_date, total, balance_due, customers(company_name, customer_reference)")
      .gt("balance_due", 0)
      .not("status", "in", "(cancelled,void)")
      .order("due_date", { ascending: true })
      .limit(300),
    supabase.from("customers").select("company_name, customer_reference"),
  ]);

  const accountNumbers = (customerRows ?? []).map((customer) => customer.customer_reference).filter(Boolean);
  const quoted = findQuotedAccountNumbers(haystack, accountNumbers);
  const generic = genericNameWords((customerRows ?? []).map((customer) => customer.company_name));

  const scored = (invoices ?? []).map((invoice) => {
    const amountMatches = Math.abs((invoice.balance_due ?? 0) - amount) < 0.005;
    const accountMatches = Boolean(invoice.customers?.customer_reference && quoted.has(invoice.customers.customer_reference));
    const nameMatches = invoice.customers ? nameAppearsIn(invoice.customers.company_name, haystack, generic) : false;
    const confidence = computeInvoiceMatchConfidence(amountMatches, nameMatches, accountMatches);
    return { ...invoice, amountMatches, nameMatches, accountMatches, confidence };
  });

  const score = (invoice: (typeof scored)[number]) =>
    (invoice.accountMatches ? 4 : 0) + (invoice.amountMatches ? 2 : 0) + (invoice.nameMatches ? 1 : 0);

  // The payer named an account: trust it and show only that customer's invoices (when it has any outstanding).
  const quotedOwnInvoices = scored.filter((invoice) => invoice.accountMatches);
  const pool = quotedOwnInvoices.length > 0 ? quotedOwnInvoices : scored.filter((invoice) => invoice.amountMatches || invoice.nameMatches);

  return pool.sort((a, b) => score(b) - score(a)).slice(0, 20) as CandidateInvoice[];
}
