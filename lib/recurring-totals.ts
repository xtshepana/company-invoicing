import Decimal from "decimal.js";
import { computeDocumentTotals } from "@/lib/documents";
import { money, roundCents, zero, type Money } from "@/lib/money";
import type { RECURRING_FREQUENCIES } from "@/lib/validations/recurring-invoices";

export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

/** The columns of a recurring invoice line that decide its price. */
export interface RecurringLine {
  product_id?: string | null;
  description?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
}

/**
 * What one invoice generated from this recurring invoice comes to. It runs the same calculation the daily job uses
 * when it creates the real invoice (computeDocumentTotals - including forcing VAT to 0 for a company that is not
 * VAT-registered), so the amount shown here is the amount that will actually be billed.
 */
export function recurringInvoiceAmount(lines: RecurringLine[], pricesIncludeVat: boolean, vatRegistered: boolean): Money {
  if (lines.length === 0) return zero();
  const { totals } = computeDocumentTotals(
    lines.map((line) => ({
      product_id: line.product_id ?? null,
      description: line.description ?? "",
      quantity: Number(line.quantity),
      unit_price: Number(line.unit_price),
      discount_percent: Number(line.discount_percent),
      vat_rate: Number(line.vat_rate),
    })),
    pricesIncludeVat,
    vatRegistered
  );
  return money(totals.total);
}

const AVERAGE_DAYS_PER_MONTH = money(365).div(12);

/** How many invoices a recurring invoice produces in an average month. */
export function invoicesPerMonth(frequency: RecurringFrequency, customIntervalDays: number | null): Decimal {
  switch (frequency) {
    case "weekly":
      return money(52).div(12);
    case "monthly":
      return money(1);
    case "every_2_months":
      return money(1).div(2);
    case "quarterly":
      return money(1).div(3);
    case "every_6_months":
      return money(1).div(6);
    case "annually":
      return money(1).div(12);
    case "custom":
      return customIntervalDays && customIntervalDays > 0 ? AVERAGE_DAYS_PER_MONTH.div(customIntervalDays) : zero();
  }
}

/** The amount spread over an average month, so weekly, quarterly and yearly invoices can be added to monthly ones. */
export function monthlyEquivalent(amount: Money, frequency: RecurringFrequency, customIntervalDays: number | null): Money {
  return amount.mul(invoicesPerMonth(frequency, customIntervalDays));
}

export interface RecurringSummaryInput {
  customer_id: string;
  frequency: RecurringFrequency;
  custom_interval_days: number | null;
  amount: Money;
}

export interface RecurringFrequencyTotal {
  frequency: RecurringFrequency;
  count: number;
  /** Sum of what each of these invoices bills per cycle. */
  total: Money;
}

export interface RecurringSummary {
  count: number;
  /** Different customers, so one customer with two recurring invoices counts once. */
  customerCount: number;
  /** Everything added up as a monthly figure (equal to the plain sum when every invoice is monthly). */
  monthlyTotal: Money;
  byFrequency: RecurringFrequencyTotal[];
  /** True when something is not billed monthly, so the monthly total is a conversion rather than a plain sum. */
  convertsToMonthly: boolean;
}

export function summarizeRecurring(rows: RecurringSummaryInput[]): RecurringSummary {
  const customers = new Set<string>();
  const groups = new Map<RecurringFrequency, RecurringFrequencyTotal>();
  let monthly = zero();

  for (const row of rows) {
    customers.add(row.customer_id);
    const group = groups.get(row.frequency) ?? { frequency: row.frequency, count: 0, total: zero() };
    group.count += 1;
    group.total = group.total.plus(row.amount);
    groups.set(row.frequency, group);
    monthly = monthly.plus(monthlyEquivalent(row.amount, row.frequency, row.custom_interval_days));
  }

  const byFrequency = [...groups.values()]
    .map((group) => ({ ...group, total: roundCents(group.total) }))
    .sort((a, b) => b.count - a.count);

  return {
    count: rows.length,
    customerCount: customers.size,
    monthlyTotal: roundCents(monthly),
    byFrequency,
    convertsToMonthly: byFrequency.some((group) => group.frequency !== "monthly"),
  };
}
