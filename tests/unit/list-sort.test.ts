import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREDIT_NOTE_DEFAULT_SORT,
  CREDIT_NOTE_SORT_OPTIONS,
  findSort,
  INVOICE_DEFAULT_SORT,
  INVOICE_SORT_OPTIONS,
  PAYMENT_DEFAULT_SORT,
  PAYMENT_SORT_OPTIONS,
  QUOTE_DEFAULT_SORT,
  QUOTE_SORT_OPTIONS,
  RECURRING_DEFAULT_SORT,
  RECURRING_SORT_OPTIONS,
  sortClauses,
  type SortOption,
} from "@/lib/list-sort";
import { creditNoteSearchSchema } from "@/lib/validations/credit-notes";
import { invoiceSearchSchema } from "@/lib/validations/invoices";
import { paymentSearchSchema } from "@/lib/validations/payments";
import { quoteSearchSchema } from "@/lib/validations/quotes";
import { recurringInvoiceSearchSchema } from "@/lib/validations/recurring-invoices";
import type { Tables } from "@/types/database";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/system-settings", () => ({ getCompanySettings: async () => ({ vat_registered: false }) }));

const CUSTOMER = "customers(company_name)";

// A type-level check, enforced by `npm run typecheck`: every sorted column must really exist on its table (or be the
// customer-name embed).
const invoiceColumns: readonly (keyof Tables<"invoices"> | typeof CUSTOMER)[] = INVOICE_SORT_OPTIONS.map((o) => o.column);
const quoteColumns: readonly (keyof Tables<"quotes"> | typeof CUSTOMER)[] = QUOTE_SORT_OPTIONS.map((o) => o.column);
const recurringColumns: readonly (keyof Tables<"recurring_invoices"> | typeof CUSTOMER)[] = RECURRING_SORT_OPTIONS.map(
  (o) => o.column
);
const paymentColumns: readonly (keyof Tables<"payments"> | typeof CUSTOMER)[] = PAYMENT_SORT_OPTIONS.map((o) => o.column);
const creditNoteColumns: readonly (keyof Tables<"credit_notes"> | typeof CUSTOMER)[] = CREDIT_NOTE_SORT_OPTIONS.map(
  (o) => o.column
);
void [invoiceColumns, quoteColumns, recurringColumns, paymentColumns, creditNoteColumns];

/** Records every .order() call; awaiting it yields an empty page. */
const orders: { column: string; options: { ascending: boolean; nullsFirst?: boolean } }[] = [];
function recordingQuery() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "lt", "gt", "not", "or", "ilike", "range", "limit"]) builder[method] = () => builder;
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

const { listInvoices, listDraftsToSend } = await import("@/server/services/invoices");
const { listQuotes } = await import("@/server/services/quotes");
const { listRecurringInvoices } = await import("@/server/services/recurring-invoices");
const { listPayments } = await import("@/server/services/payments");
const { listCreditNotes } = await import("@/server/services/credit-notes");

const LISTS = [
  ["invoices", INVOICE_SORT_OPTIONS, INVOICE_DEFAULT_SORT, invoiceSearchSchema, "customer_asc"],
  ["quotes", QUOTE_SORT_OPTIONS, QUOTE_DEFAULT_SORT, quoteSearchSchema, "customer_asc"],
  ["recurring invoices", RECURRING_SORT_OPTIONS, RECURRING_DEFAULT_SORT, recurringInvoiceSearchSchema, "next_asc"],
  ["payments", PAYMENT_SORT_OPTIONS, PAYMENT_DEFAULT_SORT, paymentSearchSchema, "date_desc"],
  ["credit notes", CREDIT_NOTE_SORT_OPTIONS, CREDIT_NOTE_DEFAULT_SORT, creditNoteSearchSchema, "date_desc"],
] as unknown as [string, readonly SortOption[], string, { parse: (input: unknown) => { sort: string } }, string][];

describe.each(LISTS)("%s sorting", (_name, options, defaultSort, schema, expectedDefault) => {
  it("opens in the expected order", () => {
    expect(defaultSort).toBe(expectedDefault);
    expect(options[0].value).toBe(defaultSort);
    expect(schema.parse({}).sort).toBe(defaultSort);
  });

  it("has unique values", () => {
    expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
  });

  it("offers every sorted column both ascending and descending", () => {
    for (const column of new Set(options.map((option) => option.column))) {
      const directions = options.filter((option) => option.column === column).map((option) => option.ascending);
      expect([...directions].sort(), column).toEqual([false, true]);
    }
  });

  it("offers customer names A to Z and Z to A", () => {
    const customer = options.filter((option) => option.column === CUSTOMER);
    expect(customer.map((option) => [option.value, option.ascending])).toEqual([
      ["customer_asc", true],
      ["customer_desc", false],
    ]);
  });

  it("accepts any of its own values and falls back to the default on anything else", () => {
    for (const option of options) expect(schema.parse({ sort: option.value }).sort).toBe(option.value);
    expect(schema.parse({ sort: "nonsense" }).sort).toBe(defaultSort);
  });
});

describe("findSort and sortClauses", () => {
  it("finds an option, or falls back to the first", () => {
    expect(findSort(INVOICE_SORT_OPTIONS, "total_asc")).toMatchObject({ column: "total", ascending: true });
    expect(findSort(INVOICE_SORT_OPTIONS, "drop table")).toBe(INVOICE_SORT_OPTIONS[0]);
    expect(findSort(QUOTE_SORT_OPTIONS, undefined)).toBe(QUOTE_SORT_OPTIONS[0]);
  });

  it("breaks ties by created_at then id in the same direction as the main column", () => {
    expect(sortClauses(findSort(INVOICE_SORT_OPTIONS, "total_asc"))).toEqual([
      { column: "total", ascending: true },
      { column: "created_at", ascending: true },
      { column: "id", ascending: true },
    ]);
  });

  it("keeps same-named customers together and each customer's rows newest first", () => {
    expect(sortClauses(findSort(INVOICE_SORT_OPTIONS, "customer_asc"))).toEqual([
      { column: CUSTOMER, ascending: true },
      { column: "customer_id", ascending: true },
      { column: "invoice_date", ascending: false },
      { column: "created_at", ascending: false },
      { column: "id", ascending: false },
    ]);
  });

  it("makes Z to A reverse only the customer name", () => {
    const [main, ...rest] = sortClauses(findSort(INVOICE_SORT_OPTIONS, "customer_desc"));
    expect(main).toEqual({ column: CUSTOMER, ascending: false });
    expect(rest).toEqual(sortClauses(findSort(INVOICE_SORT_OPTIONS, "customer_asc")).slice(1));
  });
});

describe("the list queries", () => {
  beforeEach(() => {
    orders.length = 0;
  });

  const columns = () => orders.map((order) => `${order.column} ${order.options.ascending ? "asc" : "desc"}`);

  it("list invoices by customer A to Z by default", async () => {
    await listInvoices(invoiceSearchSchema.parse({}));
    expect(columns()).toEqual([
      `${CUSTOMER} asc`,
      "customer_id asc",
      "invoice_date desc",
      "created_at desc",
      "id desc",
    ]);
    expect(orders.every((order) => order.options.nullsFirst === false)).toBe(true);
  });

  it("order invoices by the chosen column", async () => {
    await listInvoices(invoiceSearchSchema.parse({ sort: "total_asc" }));
    expect(columns()).toEqual(["total asc", "created_at asc", "id asc"]);
  });

  it("list quotes by customer A to Z by default, and put quotes with no expiry date last when sorting by expiry", async () => {
    await listQuotes(quoteSearchSchema.parse({}));
    expect(columns()[0]).toBe(`${CUSTOMER} asc`);
    orders.length = 0;
    await listQuotes(quoteSearchSchema.parse({ sort: "expiry_desc" }));
    expect(orders[0]).toEqual({ column: "expiry_date", options: { ascending: false, nullsFirst: false } });
  });

  it("keep the other lists in date order by default, and sort them by customer on request", async () => {
    await listRecurringInvoices(recurringInvoiceSearchSchema.parse({}));
    expect(columns()[0]).toBe("next_invoice_date asc");
    orders.length = 0;
    await listRecurringInvoices(recurringInvoiceSearchSchema.parse({ sort: "customer_desc" }));
    expect(columns()[0]).toBe(`${CUSTOMER} desc`);

    orders.length = 0;
    await listPayments(paymentSearchSchema.parse({}));
    expect(columns().slice(0, 2)).toEqual(["payment_date desc", "created_at desc"]);
    orders.length = 0;
    await listPayments(paymentSearchSchema.parse({ sort: "customer_asc" }));
    expect(columns()[0]).toBe(`${CUSTOMER} asc`);

    orders.length = 0;
    await listCreditNotes(creditNoteSearchSchema.parse({}));
    expect(columns().slice(0, 2)).toEqual(["credit_note_date desc", "created_at desc"]);
    orders.length = 0;
    await listCreditNotes(creditNoteSearchSchema.parse({ sort: "customer_asc" }));
    expect(columns()[0]).toBe(`${CUSTOMER} asc`);
  });

  it("list the drafts to send by customer A to Z, then invoice number", async () => {
    await listDraftsToSend();
    expect(columns()).toEqual([`${CUSTOMER} asc`, "invoice_number asc"]);
  });
});
