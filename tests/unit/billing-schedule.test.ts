import { describe, expect, it } from "vitest";
import { addDaysIso, applyBillingDay, dueDateForRecurring, lastDayOfMonth, usesBillingDay } from "@/lib/billing-schedule";
import { periodMonthOf, reminderStageForDate, todayInSouthAfrica } from "@/lib/reminder-schedule";

describe("applyBillingDay (every invoice is created on the 26th)", () => {
  it("moves a date before the 26th forward to the 26th of the same month", () => {
    expect(applyBillingDay("2026-11-10", "monthly", 26)).toBe("2026-11-26");
    expect(applyBillingDay("2026-11-01", "monthly", 26)).toBe("2026-11-26");
  });

  it("keeps a date that is already the 26th", () => {
    expect(applyBillingDay("2026-11-26", "monthly", 26)).toBe("2026-11-26");
  });

  it("moves a date after the 26th to the 26th of the next month", () => {
    expect(applyBillingDay("2026-10-27", "monthly", 26)).toBe("2026-11-26");
    expect(applyBillingDay("2026-10-31", "monthly", 26)).toBe("2026-11-26");
  });

  it("rolls over the year end", () => {
    expect(applyBillingDay("2026-12-28", "monthly", 26)).toBe("2027-01-26");
    expect(applyBillingDay("2026-12-26", "quarterly", 26)).toBe("2026-12-26");
  });

  it("applies to every month-based schedule", () => {
    for (const frequency of ["monthly", "every_2_months", "quarterly", "every_6_months", "annually"] as const) {
      expect(usesBillingDay(frequency), frequency).toBe(true);
      expect(applyBillingDay("2026-11-10", frequency, 26), frequency).toBe("2026-11-26");
    }
  });

  it("leaves weekly and custom-day schedules on their own rhythm", () => {
    expect(usesBillingDay("weekly")).toBe(false);
    expect(usesBillingDay("custom")).toBe(false);
    expect(applyBillingDay("2026-11-10", "weekly", 26)).toBe("2026-11-10");
    expect(applyBillingDay("2026-11-10", "custom", 26)).toBe("2026-11-10");
  });

  it("changes nothing when no billing day is set", () => {
    expect(applyBillingDay("2026-11-10", "monthly", null)).toBe("2026-11-10");
    expect(applyBillingDay("2026-11-10", "monthly", 0)).toBe("2026-11-10");
  });

  it("clamps a day that a short month does not have (the setting allows up to 28, but stay safe)", () => {
    expect(applyBillingDay("2027-02-01", "monthly", 30)).toBe("2027-02-28");
  });

  it("rejects something that is not a date instead of guessing", () => {
    expect(() => applyBillingDay("26/11/2026", "monthly", 26)).toThrow();
  });
});

describe("lastDayOfMonth / addDaysIso", () => {
  it("finds the real last day, including February in leap and non-leap years", () => {
    expect(lastDayOfMonth("2026-10-26")).toBe("2026-10-31");
    expect(lastDayOfMonth("2026-11-26")).toBe("2026-11-30");
    expect(lastDayOfMonth("2027-02-26")).toBe("2027-02-28");
    expect(lastDayOfMonth("2028-02-26")).toBe("2028-02-29");
    expect(lastDayOfMonth("2026-12-01")).toBe("2026-12-31");
  });

  it("adds days across month and year ends", () => {
    expect(addDaysIso("2026-10-26", 30)).toBe("2026-11-25");
    expect(addDaysIso("2026-12-26", 10)).toBe("2027-01-05");
    expect(addDaysIso("2026-10-26", 0)).toBe("2026-10-26");
  });
});

describe("dueDateForRecurring", () => {
  const base = { invoiceDate: "2026-10-26", recurringTermsDays: null, customerTermsDays: null, defaultTermsDays: 30, dueAtMonthEnd: false };

  it("uses the company's default days when nothing else applies", () => {
    expect(dueDateForRecurring(base)).toBe("2026-11-25");
  });

  it("falls due on the last day of the month when that rule is on", () => {
    expect(dueDateForRecurring({ ...base, dueAtMonthEnd: true })).toBe("2026-10-31");
    expect(dueDateForRecurring({ ...base, invoiceDate: "2026-11-26", dueAtMonthEnd: true })).toBe("2026-11-30");
    expect(dueDateForRecurring({ ...base, invoiceDate: "2027-02-26", dueAtMonthEnd: true })).toBe("2027-02-28");
  });

  it("lets terms typed on the recurring invoice or set on the customer win over the month-end rule", () => {
    expect(dueDateForRecurring({ ...base, dueAtMonthEnd: true, recurringTermsDays: 14 })).toBe("2026-11-09");
    expect(dueDateForRecurring({ ...base, dueAtMonthEnd: true, customerTermsDays: 7 })).toBe("2026-11-02");
    expect(dueDateForRecurring({ ...base, dueAtMonthEnd: true, recurringTermsDays: 0, customerTermsDays: 7 })).toBe("2026-10-26");
  });

  it("prefers the recurring invoice's own terms over the customer's", () => {
    expect(dueDateForRecurring({ ...base, recurringTermsDays: 10, customerTermsDays: 45 })).toBe("2026-11-05");
  });
});

describe("reminderStageForDate (last day of the month, the 5th, the 7th)", () => {
  it("is reminder 1 on the real last day of every kind of month", () => {
    for (const day of ["2026-01-31", "2026-04-30", "2026-10-31", "2026-11-30", "2026-12-31", "2027-02-28", "2028-02-29"]) {
      expect(reminderStageForDate(day), day).toBe("reminder_1");
    }
  });

  it("is not reminder 1 on the day before the last day, or on the 28th of a longer month", () => {
    expect(reminderStageForDate("2026-10-30")).toBeNull();
    expect(reminderStageForDate("2026-10-28")).toBeNull();
    expect(reminderStageForDate("2028-02-28")).toBeNull(); // leap year: the 29th is the last day
  });

  it("is the final reminder on the 5th and the blocking list on the 7th", () => {
    expect(reminderStageForDate("2026-11-05")).toBe("reminder_2");
    expect(reminderStageForDate("2026-11-07")).toBe("block_list");
    expect(reminderStageForDate("2027-02-05")).toBe("reminder_2");
    expect(reminderStageForDate("2027-02-07")).toBe("block_list");
  });

  it("does nothing on any other day", () => {
    for (const day of ["2026-11-01", "2026-11-04", "2026-11-06", "2026-11-08", "2026-11-26", "2026-11-29"]) {
      expect(reminderStageForDate(day), day).toBeNull();
    }
  });

  it("fires on exactly three days in an ordinary month", () => {
    let hits = 0;
    for (let day = 1; day <= 30; day++) {
      if (reminderStageForDate(`2026-11-${String(day).padStart(2, "0")}`)) hits++;
    }
    expect(hits).toBe(3);
  });

  it("rejects something that is not a date", () => {
    expect(() => reminderStageForDate("5 Nov 2026")).toThrow();
  });
});

describe("periodMonthOf / todayInSouthAfrica", () => {
  it("keys a reminder by the first day of its month", () => {
    expect(periodMonthOf("2026-10-31")).toBe("2026-10-01");
    expect(periodMonthOf("2026-11-05")).toBe("2026-11-01");
  });

  it("uses the South African date, which is two hours ahead of UTC", () => {
    // 22:30 UTC on the 30th is 00:30 on the 31st in South Africa - the month-end reminder day
    expect(todayInSouthAfrica(new Date("2026-10-30T22:30:00Z"))).toBe("2026-10-31");
    expect(reminderStageForDate(todayInSouthAfrica(new Date("2026-10-30T22:30:00Z")))).toBe("reminder_1");
    // 21:59 UTC is still the 30th at 23:59
    expect(todayInSouthAfrica(new Date("2026-10-30T21:59:00Z"))).toBe("2026-10-30");
    expect(todayInSouthAfrica(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(todayInSouthAfrica(new Date("2026-11-05T10:00:00Z"))).toBe("2026-11-05");
  });
});
