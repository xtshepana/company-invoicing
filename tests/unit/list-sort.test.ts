import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SORT,
  findSort,
  INVOICE_SORT_OPTIONS,
  QUOTE_SORT_OPTIONS,
  type SortOption,
} from "@/lib/list-sort";
import { invoiceSearchSchema } from "@/lib/validations/invoices";
import { quoteSearchSchema } from "@/lib/validations/quotes";
import type { Tables } from "@/types/database";

vi.mock("server-only", () => ({}));

// A type-level check, enforced by `npm run typecheck`: every sortable column must really exist on its table.
const invoiceColumns: readonly (keyof Tables<"invoices">)[] = INVOICE_SORT_OPTIONS.map((option) => option.column);
const quoteColumns: readonly (keyof Tables<"quotes">)[] = QUOTE_SORT_OPTIONS.map((option) => option.column);
void invoiceColumns;
void quoteColumns;

/** Records every .order() call; awaiting it yields an empty page. */
const orders: { column: string; options: { ascending: boolean; nullsFirst?: boolean } }[] = [];
function recordingQuery() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "lt", "gt", "not", "or", "range"]) builder[method] = () => builder;
  builder.order = (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => {
    orders.push({ column, options });
    return builder;
  };
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: [], count: 0, error: null });
  return builder;
}
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ from: () => recordingQuery() }),
}));

const { listInvoices } = await import("@/server/services/invoices");
const { listQuotes } = await import("@/server/services/quotes");

describe.each([
  ["invoices", INVOICE_SORT_OPTIONS],
  ["quotes", QUOTE_SORT_OPTIONS],
] as [string, readonly SortOption[]][])("%s sort options", (_name, options) => {
  it("starts with the default, newest first", () => {
    expect(options[0].value).toBe(DEFAULT_SORT);
    expect(options[0]).toMatchObject({ column: expect.stringMatching(/_date$/), ascending: false });
  });

  it("has unique values", () => {
    expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
  });

  it("offers every sorted column both ascending and descending", () => {
    const columns = new Set(options.map((option) => option.column));
    for (const column of columns) {
      const directions = options.filter((option) => option.column === column).map((option) => option.ascending);
      expect(directions.sort(), column).toEqual([false, true]);
    }
  });
});

describe("findSort", () => {
  it("finds an option by its value", () => {
    expect(findSort(INVOICE_SORT_OPTIONS, "total_asc")).toMatchObject({ column: "total", ascending: true });
  });

  it("falls back to the first option for an unknown or missing value", () => {
    expect(findSort(INVOICE_SORT_OPTIONS, "drop table")).toBe(INVOICE_SORT_OPTIONS[0]);
    expect(findSort(QUOTE_SORT_OPTIONS, undefined)).toBe(QUOTE_SORT_OPTIONS[0]);
  });
});

describe("search params", () => {
  it("default to newest first", () => {
    expect(invoiceSearchSchema.parse({}).sort).toBe("date_desc");
    expect(quoteSearchSchema.parse({}).sort).toBe("date_desc");
  });

  it("accept a valid sort and keep the other params", () => {
    expect(invoiceSearchSchema.parse({ sort: "balance_desc", status: "overdue", page: "3" })).toMatchObject({
      sort: "balance_desc",
      status: "overdue",
      page: 3,
    });
    expect(quoteSearchSchema.parse({ sort: "expiry_asc" }).sort).toBe("expiry_asc");
  });

  it("fall back to the default instead of failing on a bad sort", () => {
    expect(invoiceSearchSchema.parse({ sort: "nonsense" }).sort).toBe("date_desc");
    expect(quoteSearchSchema.parse({ sort: "balance_desc" }).sort).toBe("date_desc"); // an invoice-only sort
  });
});

describe("the list queries", () => {
  beforeEach(() => {
    orders.length = 0;
  });

  it("order invoices by the chosen column and direction, with stable tie-breakers", async () => {
    await listInvoices(invoiceSearchSchema.parse({ sort: "total_asc" }));
    expect(orders).toEqual([
      { column: "total", options: { ascending: true, nullsFirst: false } },
      { column: "created_at", options: { ascending: true } },
      { column: "id", options: { ascending: true } },
    ]);
  });

  it("keep the old newest-first order by default", async () => {
    await listInvoices(invoiceSearchSchema.parse({}));
    expect(orders[0]).toEqual({ column: "invoice_date", options: { ascending: false, nullsFirst: false } });
    expect(orders[1]).toEqual({ column: "created_at", options: { ascending: false } });
  });

  it("order quotes, putting quotes with no expiry date last", async () => {
    await listQuotes(quoteSearchSchema.parse({ sort: "expiry_desc" }));
    expect(orders[0]).toEqual({ column: "expiry_date", options: { ascending: false, nullsFirst: false } });
  });
});
