export interface SortClause {
  column: string;
  ascending: boolean;
}

export interface SortOption extends SortClause {
  /** What goes in the ?sort= query param. */
  value: string;
  /** What the dropdown shows. */
  label: string;
  /** Tie-breakers after the main column. Without them, created_at then id follow the main direction. */
  then?: readonly SortClause[];
}

/**
 * The customer's name lives on the joined customers table. PostgREST orders a list by a to-one embedded column when the
 * embed is in the select (every list selects customers(company_name)). Same-named customers stay grouped by id, and
 * each customer's own rows come out newest first.
 */
const CUSTOMER_NAME = "customers(company_name)";
function byCustomer<V extends string>(value: V, label: string, ascending: boolean, dateColumn: string) {
  return {
    value,
    label,
    column: CUSTOMER_NAME as typeof CUSTOMER_NAME,
    ascending,
    then: [
      { column: "customer_id", ascending: true },
      { column: dateColumn, ascending: false },
      { column: "created_at", ascending: false },
      { column: "id", ascending: false },
    ] satisfies SortClause[],
  };
}

/**
 * Every sort a list offers, both directions of each column. The first entry is that list's default order.
 * Invoices and quotes open in customer A to Z; the other lists keep their date order.
 */
export const INVOICE_SORT_OPTIONS = [
  byCustomer("customer_asc", "Customer: A to Z", true, "invoice_date"),
  byCustomer("customer_desc", "Customer: Z to A", false, "invoice_date"),
  { value: "date_desc", label: "Invoice date: newest first", column: "invoice_date", ascending: false },
  { value: "date_asc", label: "Invoice date: oldest first", column: "invoice_date", ascending: true },
  { value: "due_asc", label: "Due date: soonest first", column: "due_date", ascending: true },
  { value: "due_desc", label: "Due date: latest first", column: "due_date", ascending: false },
  { value: "number_desc", label: "Invoice #: high to low", column: "invoice_number", ascending: false },
  { value: "number_asc", label: "Invoice #: low to high", column: "invoice_number", ascending: true },
  { value: "total_desc", label: "Total: high to low", column: "total", ascending: false },
  { value: "total_asc", label: "Total: low to high", column: "total", ascending: true },
  { value: "balance_desc", label: "Balance due: high to low", column: "balance_due", ascending: false },
  { value: "balance_asc", label: "Balance due: low to high", column: "balance_due", ascending: true },
] as const satisfies readonly SortOption[];

export const QUOTE_SORT_OPTIONS = [
  byCustomer("customer_asc", "Customer: A to Z", true, "quote_date"),
  byCustomer("customer_desc", "Customer: Z to A", false, "quote_date"),
  { value: "date_desc", label: "Quote date: newest first", column: "quote_date", ascending: false },
  { value: "date_asc", label: "Quote date: oldest first", column: "quote_date", ascending: true },
  { value: "expiry_asc", label: "Expiry date: soonest first", column: "expiry_date", ascending: true },
  { value: "expiry_desc", label: "Expiry date: latest first", column: "expiry_date", ascending: false },
  { value: "number_desc", label: "Quote #: high to low", column: "quote_number", ascending: false },
  { value: "number_asc", label: "Quote #: low to high", column: "quote_number", ascending: true },
  { value: "total_desc", label: "Total: high to low", column: "total", ascending: false },
  { value: "total_asc", label: "Total: low to high", column: "total", ascending: true },
] as const satisfies readonly SortOption[];

export const RECURRING_SORT_OPTIONS = [
  { value: "next_asc", label: "Next invoice: soonest first", column: "next_invoice_date", ascending: true },
  { value: "next_desc", label: "Next invoice: latest first", column: "next_invoice_date", ascending: false },
  byCustomer("customer_asc", "Customer: A to Z", true, "next_invoice_date"),
  byCustomer("customer_desc", "Customer: Z to A", false, "next_invoice_date"),
] as const satisfies readonly SortOption[];

export const PAYMENT_SORT_OPTIONS = [
  { value: "date_desc", label: "Payment date: newest first", column: "payment_date", ascending: false },
  { value: "date_asc", label: "Payment date: oldest first", column: "payment_date", ascending: true },
  byCustomer("customer_asc", "Customer: A to Z", true, "payment_date"),
  byCustomer("customer_desc", "Customer: Z to A", false, "payment_date"),
  { value: "amount_desc", label: "Amount: high to low", column: "amount", ascending: false },
  { value: "amount_asc", label: "Amount: low to high", column: "amount", ascending: true },
] as const satisfies readonly SortOption[];

export const CREDIT_NOTE_SORT_OPTIONS = [
  { value: "date_desc", label: "Date: newest first", column: "credit_note_date", ascending: false },
  { value: "date_asc", label: "Date: oldest first", column: "credit_note_date", ascending: true },
  byCustomer("customer_asc", "Customer: A to Z", true, "credit_note_date"),
  byCustomer("customer_desc", "Customer: Z to A", false, "credit_note_date"),
  { value: "number_desc", label: "Credit note #: high to low", column: "credit_note_number", ascending: false },
  { value: "number_asc", label: "Credit note #: low to high", column: "credit_note_number", ascending: true },
  { value: "total_desc", label: "Total: high to low", column: "total", ascending: false },
  { value: "total_asc", label: "Total: low to high", column: "total", ascending: true },
] as const satisfies readonly SortOption[];

type ValueOf<T extends readonly SortOption[]> = T[number]["value"];
type Values<T extends readonly SortOption[]> = [ValueOf<T>, ...ValueOf<T>[]];

export const INVOICE_SORT_VALUES = INVOICE_SORT_OPTIONS.map((o) => o.value) as Values<typeof INVOICE_SORT_OPTIONS>;
export const QUOTE_SORT_VALUES = QUOTE_SORT_OPTIONS.map((o) => o.value) as Values<typeof QUOTE_SORT_OPTIONS>;
export const RECURRING_SORT_VALUES = RECURRING_SORT_OPTIONS.map((o) => o.value) as Values<typeof RECURRING_SORT_OPTIONS>;
export const PAYMENT_SORT_VALUES = PAYMENT_SORT_OPTIONS.map((o) => o.value) as Values<typeof PAYMENT_SORT_OPTIONS>;
export const CREDIT_NOTE_SORT_VALUES = CREDIT_NOTE_SORT_OPTIONS.map((o) => o.value) as Values<
  typeof CREDIT_NOTE_SORT_OPTIONS
>;

export const INVOICE_DEFAULT_SORT = INVOICE_SORT_OPTIONS[0].value;
export const QUOTE_DEFAULT_SORT = QUOTE_SORT_OPTIONS[0].value;
export const RECURRING_DEFAULT_SORT = RECURRING_SORT_OPTIONS[0].value;
export const PAYMENT_DEFAULT_SORT = PAYMENT_SORT_OPTIONS[0].value;
export const CREDIT_NOTE_DEFAULT_SORT = CREDIT_NOTE_SORT_OPTIONS[0].value;

/** The option for a ?sort= value; anything unknown (an old bookmark, a hand-edited link) gets the first/default one. */
export function findSort<T extends SortOption>(options: readonly T[], value: string | undefined): T {
  return options.find((option) => option.value === value) ?? options[0];
}

/** The full ORDER BY for a sort, main column first. The trailing tie-breakers make paging deterministic. */
export function sortClauses(sort: SortOption): SortClause[] {
  const ties = sort.then ?? [
    { column: "created_at", ascending: sort.ascending },
    { column: "id", ascending: sort.ascending },
  ];
  return [{ column: sort.column, ascending: sort.ascending }, ...ties];
}
