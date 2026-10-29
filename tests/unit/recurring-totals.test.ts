import { beforeEach, describe, expect, it, vi } from "vitest";
import { money } from "@/lib/money";
import { invoicesPerMonth, monthlyEquivalent, recurringInvoiceAmount, summarizeRecurring } from "@/lib/recurring-totals";

describe("recurringInvoiceAmount", () => {
  const line = (unit_price: number, over: Partial<{ quantity: number; discount_percent: number; vat_rate: number }> = {}) => ({
    quantity: 1,
    discount_percent: 0,
    vat_rate: 0,
    unit_price,
    ...over,
  });

  it("adds up the lines, applying quantity and discount", () => {
    const amount = recurringInvoiceAmount([line(500, { quantity: 2 }), line(100, { discount_percent: 10 })], false, false);
    expect(amount.toFixed(2)).toBe("1090.00"); // 1000 + 90
  });

  it("charges no VAT when the company is not VAT-registered, whatever the line says", () => {
    expect(recurringInvoiceAmount([line(100, { vat_rate: 15 })], false, false).toFixed(2)).toBe("100.00");
  });

  it("adds VAT on top when the company is registered and prices exclude VAT", () => {
    expect(recurringInvoiceAmount([line(100, { vat_rate: 15 })], false, true).toFixed(2)).toBe("115.00");
  });

  it("does not add VAT again when prices already include it", () => {
    expect(recurringInvoiceAmount([line(115, { vat_rate: 15 })], true, true).toFixed(2)).toBe("115.00");
  });

  it("is zero for a recurring invoice with no lines", () => {
    expect(recurringInvoiceAmount([], false, true).toFixed(2)).toBe("0.00");
  });

  it("accepts the numeric strings the database can return", () => {
    const amount = recurringInvoiceAmount(
      [{ quantity: "2" as unknown as number, unit_price: "250.50" as unknown as number, discount_percent: "0" as unknown as number, vat_rate: "0" as unknown as number }],
      false,
      false
    );
    expect(amount.toFixed(2)).toBe("501.00");
  });
});

describe("monthlyEquivalent", () => {
  const hundred = money(100);

  it("leaves a monthly amount alone", () => {
    expect(monthlyEquivalent(hundred, "monthly", null).toFixed(2)).toBe("100.00");
  });

  it("spreads the other schedules over an average month", () => {
    expect(monthlyEquivalent(money(1200), "annually", null).toFixed(2)).toBe("100.00");
    expect(monthlyEquivalent(money(600), "every_6_months", null).toFixed(2)).toBe("100.00");
    expect(monthlyEquivalent(money(300), "quarterly", null).toFixed(2)).toBe("100.00");
    expect(monthlyEquivalent(money(200), "every_2_months", null).toFixed(2)).toBe("100.00");
    expect(monthlyEquivalent(money(100), "weekly", null).toFixed(2)).toBe("433.33"); // 52 invoices a year / 12
  });

  it("converts a custom interval from its number of days", () => {
    expect(monthlyEquivalent(money(100), "custom", 30).toFixed(2)).toBe("101.39"); // 365/12 / 30 invoices a month
    expect(invoicesPerMonth("custom", null).toFixed(2)).toBe("0.00"); // an unset interval contributes nothing instead of dividing by zero
    expect(invoicesPerMonth("custom", 0).toFixed(2)).toBe("0.00");
  });
});

describe("summarizeRecurring", () => {
  const row = (customer_id: string, amount: number, frequency: Parameters<typeof monthlyEquivalent>[1] = "monthly", days: number | null = null) => ({
    customer_id,
    amount: money(amount),
    frequency,
    custom_interval_days: days,
  });

  it("totals every client when all are monthly - a plain sum", () => {
    const summary = summarizeRecurring([row("a", 570), row("b", 1200), row("c", 99.5)]);

    expect(summary.count).toBe(3);
    expect(summary.customerCount).toBe(3);
    expect(summary.monthlyTotal.toFixed(2)).toBe("1869.50");
    expect(summary.convertsToMonthly).toBe(false);
    expect(summary.byFrequency).toHaveLength(1);
    expect(summary.byFrequency[0].total.toFixed(2)).toBe("1869.50");
  });

  it("counts a client with two recurring invoices once, but adds both amounts", () => {
    const summary = summarizeRecurring([row("a", 100), row("a", 50), row("b", 25)]);

    expect(summary.count).toBe(3);
    expect(summary.customerCount).toBe(2);
    expect(summary.monthlyTotal.toFixed(2)).toBe("175.00");
  });

  it("does not drift on cents (no floating point sums)", () => {
    const summary = summarizeRecurring(Array.from({ length: 10 }, (_, i) => row(`c${i}`, 0.1)));
    expect(summary.monthlyTotal.toFixed(2)).toBe("1.00");
  });

  it("converts mixed schedules to a monthly figure and breaks them down by frequency", () => {
    const summary = summarizeRecurring([row("a", 100), row("b", 1200, "annually"), row("c", 300, "quarterly"), row("d", 50)]);

    expect(summary.monthlyTotal.toFixed(2)).toBe("350.00"); // 100 monthly + 1200/12 + 300/3 + 50 monthly
    expect(summary.convertsToMonthly).toBe(true);
    expect(summary.byFrequency.map((g) => [g.frequency, g.count, g.total.toFixed(2)])).toEqual([
      ["monthly", 2, "150.00"],
      ["annually", 1, "1200.00"],
      ["quarterly", 1, "300.00"],
    ]);
  });

  it("is all zeros for nothing", () => {
    const summary = summarizeRecurring([]);
    expect(summary.count).toBe(0);
    expect(summary.customerCount).toBe(0);
    expect(summary.monthlyTotal.toFixed(2)).toBe("0.00");
    expect(summary.byFrequency).toEqual([]);
    expect(summary.convertsToMonthly).toBe(false);
  });
});

// ---- the service: the total must cover every matching recurring invoice, not just the page being viewed ----
vi.mock("server-only", () => ({}));

const state = {
  vatRegistered: false,
  pageRows: [] as unknown[],
  allRows: [] as unknown[],
  filters: [] as [string, string][],
  ranges: [] as [number, number][],
};

/** A query-builder stand-in: records the filters and ranges, returns rows for the page or for the summary. */
function query(kind: "list" | "summary") {
  const builder: Record<string, unknown> = {};
  builder.select = (_columns: string, options?: { count?: string }) => {
    (builder as { counted: boolean }).counted = Boolean(options?.count);
    return builder;
  };
  builder.order = () => builder;
  builder.eq = (column: string, value: string) => {
    state.filters.push([column, value]);
    return builder;
  };
  builder.ilike = (column: string, value: string) => {
    state.filters.push([column, value]);
    return builder;
  };
  builder.range = async (from: number, to: number) => {
    state.ranges.push([from, to]);
    const rows = kind === "list" ? state.pageRows : state.allRows.slice(from, to + 1);
    return { data: rows, count: state.allRows.length, error: null };
  };
  return builder;
}

let kindForNextQuery: "list" | "summary" = "list";
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ from: () => query(kindForNextQuery) }),
}));
vi.mock("@/lib/config/system-settings", () => ({
  getCompanySettings: async () => ({ vat_registered: state.vatRegistered, default_currency: "ZAR" }),
}));

const { getRecurringSummary, listRecurringInvoices } = await import("@/server/services/recurring-invoices");

function recurring(i: number, price: number, extra: Record<string, unknown> = {}) {
  return {
    id: `r${i}`,
    customer_id: `c${i}`,
    description: `Plan ${i}`,
    frequency: "monthly",
    custom_interval_days: null,
    prices_include_vat: false,
    status: "active",
    next_invoice_date: "2026-11-01",
    customers: { company_name: `Customer ${i}` },
    recurring_invoice_items: [{ quantity: 1, unit_price: price, discount_percent: 0, vat_rate: 0 }],
    ...extra,
  };
}

beforeEach(() => {
  state.vatRegistered = false;
  state.pageRows = [];
  state.allRows = [];
  state.filters = [];
  state.ranges = [];
});

describe("getRecurringSummary", () => {
  it("adds up every matching recurring invoice, even though a page only shows 20", async () => {
    state.allRows = Array.from({ length: 35 }, (_, i) => recurring(i, 100));
    kindForNextQuery = "summary";

    const summary = await getRecurringSummary({ q: "", status: "active", page: 1 });

    expect(summary.count).toBe(35);
    expect(summary.customerCount).toBe(35);
    expect(summary.monthlyTotal.toFixed(2)).toBe("3500.00");
  });

  it("reads in batches past the 1000-row limit so a big list is not under-counted", async () => {
    state.allRows = Array.from({ length: 2300 }, (_, i) => recurring(i, 10));
    kindForNextQuery = "summary";

    const summary = await getRecurringSummary({ q: "", status: "active", page: 1 });

    expect(summary.count).toBe(2300);
    expect(summary.monthlyTotal.toFixed(2)).toBe("23000.00");
    expect(state.ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("applies the same status and search filters as the list", async () => {
    state.allRows = [recurring(1, 100)];
    kindForNextQuery = "summary";

    await getRecurringSummary({ q: "hosting", status: "paused", page: 3 });

    expect(state.filters).toEqual([
      ["status", "paused"],
      ["description", "%hosting%"],
    ]);
  });

  it("does not filter by status when 'all' is chosen", async () => {
    state.allRows = [recurring(1, 100)];
    kindForNextQuery = "summary";

    await getRecurringSummary({ q: "", status: "all", page: 1 });

    expect(state.filters).toEqual([]);
  });

  it("prices a VAT-registered company's invoices with VAT, like the invoice it will generate", async () => {
    state.vatRegistered = true;
    state.allRows = [recurring(1, 100, { recurring_invoice_items: [{ quantity: 1, unit_price: 100, discount_percent: 0, vat_rate: 15 }] })];
    kindForNextQuery = "summary";

    const summary = await getRecurringSummary({ q: "", status: "active", page: 1 });

    expect(summary.monthlyTotal.toFixed(2)).toBe("115.00");
  });

  it("totals a mix of schedules as a monthly figure", async () => {
    state.allRows = [recurring(1, 100), recurring(2, 1200, { frequency: "annually" })];
    kindForNextQuery = "summary";

    const summary = await getRecurringSummary({ q: "", status: "active", page: 1 });

    expect(summary.monthlyTotal.toFixed(2)).toBe("200.00");
    expect(summary.convertsToMonthly).toBe(true);
  });
});

describe("listRecurringInvoices", () => {
  it("gives each row its amount and drops the raw line items", async () => {
    state.pageRows = [recurring(1, 570), recurring(2, 250, { recurring_invoice_items: [{ quantity: 2, unit_price: 125, discount_percent: 0, vat_rate: 0 }] })];
    state.allRows = state.pageRows;
    kindForNextQuery = "list";

    const page = await listRecurringInvoices({ q: "", status: "active", sort: "next_asc", page: 1 });

    expect(page.rows.map((row) => row.amount)).toEqual(["570.00", "250.00"]);
    expect(page.rows[0]).not.toHaveProperty("recurring_invoice_items");
    expect(page.rows[0].customers?.company_name).toBe("Customer 1");
    expect(page.totalCount).toBe(2);
  });
});
