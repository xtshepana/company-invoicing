import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCustomerById, type Customer } from "@/server/services/customers";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/payments";

export interface StatementLine {
  date: string | null;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface CustomerStatement {
  customer: Customer;
  lines: StatementLine[];
  closingBalance: number;
}

/**
 * A payment's allocation across invoices (including any portion parked as
 * customer credit) is an internal bookkeeping detail — the payment's full
 * amount already reduced the customer's balance the moment it was
 * received, so only invoices (debits) and payments (credits) are real
 * statement events. Applying previously-banked credit to a later invoice
 * moves money the statement already counted; it does not need its own
 * line, or the customer's balance would be double-counted.
 */
export async function getCustomerStatement(customerId: string): Promise<CustomerStatement | null> {
  const customer = await getCustomerById(customerId);
  if (!customer) return null;

  const supabase = await createSupabaseServerClient();
  const [{ data: invoices }, { data: payments }] = await Promise.all([
    supabase
      .from("invoices")
      .select("invoice_number, invoice_date, total, status")
      .eq("customer_id", customerId)
      .not("status", "in", "(cancelled,void)"),
    supabase
      .from("payments")
      .select("id, payment_date, amount, payment_method, bank_reference")
      .eq("customer_id", customerId),
  ]);

  interface Event {
    date: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    sortKey: string;
  }

  const events: Event[] = [];
  for (const invoice of invoices ?? []) {
    events.push({
      date: invoice.invoice_date,
      reference: invoice.invoice_number,
      description: "Invoice",
      debit: invoice.total,
      credit: 0,
      sortKey: `${invoice.invoice_date}-0`,
    });
  }
  for (const payment of payments ?? []) {
    events.push({
      date: payment.payment_date,
      reference: payment.bank_reference || "",
      description: `Payment (${PAYMENT_METHOD_LABELS[payment.payment_method]})`,
      debit: 0,
      credit: payment.amount,
      sortKey: `${payment.payment_date}-1`,
    });
  }
  events.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let balance = customer.opening_balance;
  const lines: StatementLine[] = [
    { date: null, reference: "", description: "Opening balance", debit: 0, credit: 0, balance },
  ];
  for (const event of events) {
    balance = balance + event.debit - event.credit;
    lines.push({
      date: event.date,
      reference: event.reference,
      description: event.description,
      debit: event.debit,
      credit: event.credit,
      balance,
    });
  }

  return { customer, lines, closingBalance: balance };
}
