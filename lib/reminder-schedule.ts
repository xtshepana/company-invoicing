/**
 * The payment reminder calendar, as agreed for monthly billing (invoices are created on the 26th and fall due on the
 * last day of the month):
 *   - last day of every month  -> reminder 1, emailed to each customer with an unpaid invoice
 *   - the 5th                  -> reminder 2 (the final one), emailed the same way
 *   - the 7th                  -> ONE list of every unpaid account, sent to the owner for blocking
 * Pure date rules; the daily job (server/services/payment-reminders.ts) acts on them.
 */
export type ReminderStage = "reminder_1" | "reminder_2" | "block_list";

export const REMINDER_DAYS = { reminder2: 5, blockList: 7 } as const;

/** Which reminder step, if any, falls on this date (YYYY-MM-DD). The last day is the real last day, so February works. */
export function reminderStageForDate(todayIso: string): ReminderStage | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayIso);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${todayIso}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (day === lastDay) return "reminder_1";
  if (day === REMINDER_DAYS.reminder2) return "reminder_2";
  if (day === REMINDER_DAYS.blockList) return "block_list";
  return null;
}

/** The first day of the month `todayIso` is in - the key that stops a reminder going twice in one month. */
export function periodMonthOf(todayIso: string): string {
  return `${todayIso.slice(0, 7)}-01`;
}

/**
 * Today's date in South Africa. The daily job used to use the UTC date, which is still "yesterday" for the first two
 * hours of a South African day - enough to send a month-end reminder on the wrong day or generate an invoice a day late.
 */
export function todayInSouthAfrica(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
