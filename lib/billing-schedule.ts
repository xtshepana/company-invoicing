import type { RecurringFrequency } from "@/lib/recurring-totals";

/**
 * Date rules for recurring billing: the company-wide billing day (e.g. every invoice is created on the 26th) and the
 * "due on the last day of the month" rule. Pure functions over YYYY-MM-DD strings (no time zones, no "now"), so every
 * rule here can be tested directly. The same billing-day rule is enforced in the database when the next date is worked
 * out after an invoice is generated (supabase/migrations/0040_billing_schedule.sql) - keep the two in step.
 */

/** Frequencies counted in whole months, which the billing day applies to. Weekly and custom-day schedules keep their own rhythm. */
const MONTH_BASED: ReadonlySet<RecurringFrequency> = new Set(["monthly", "every_2_months", "quarterly", "every_6_months", "annually"]);

export function usesBillingDay(frequency: RecurringFrequency): boolean {
  return MONTH_BASED.has(frequency);
}

function parse(iso: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${iso}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function format(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The last day of the month `iso` falls in (28-31). */
export function lastDayOfMonth(iso: string): string {
  const { year, month } = parse(iso);
  return format(year, month, daysInMonth(year, month));
}

/**
 * The first date on or after `iso` that falls on the company billing day. A date already on the billing day, or before
 * it in its month, stays in that month; one after it moves to the billing day of the next month. With no billing day
 * set, or for a weekly / custom-day schedule, the date is returned unchanged.
 */
export function applyBillingDay(iso: string, frequency: RecurringFrequency, billingDay: number | null): string {
  if (!billingDay || !usesBillingDay(frequency)) return iso;
  const { year, month, day } = parse(iso);
  const clamp = (y: number, m: number) => Math.min(billingDay, daysInMonth(y, m));
  if (day <= clamp(year, month)) return format(year, month, clamp(year, month));
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return format(nextYear, nextMonth, clamp(nextYear, nextMonth));
}

export interface DueDateInput {
  invoiceDate: string;
  /** Terms typed on the recurring invoice itself. */
  recurringTermsDays: number | null;
  /** Terms set on the customer. */
  customerTermsDays: number | null;
  defaultTermsDays: number;
  /** Company rule: invoices fall due on the last day of the month they are issued. */
  dueAtMonthEnd: boolean;
}

/**
 * When an invoice generated from a recurring invoice falls due. Terms that someone set deliberately for this recurring
 * invoice or this customer win; otherwise the month-end rule applies if it is switched on; otherwise the company's
 * default number of days.
 */
export function dueDateForRecurring(input: DueDateInput): string {
  if (input.recurringTermsDays !== null) return addDaysIso(input.invoiceDate, input.recurringTermsDays);
  if (input.customerTermsDays !== null) return addDaysIso(input.invoiceDate, input.customerTermsDays);
  if (input.dueAtMonthEnd) return lastDayOfMonth(input.invoiceDate);
  return addDaysIso(input.invoiceDate, input.defaultTermsDays);
}
