export interface SortOption {
  /** What goes in the ?sort= query param. */
  value: string;
  /** What the dropdown shows. */
  label: string;
  column: string;
  ascending: boolean;
}

export const DEFAULT_SORT = "date_desc";

/** Every sort a list offers, as both directions of each column. The first entry is the default order. */
export const INVOICE_SORT_OPTIONS = [
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
  { value: "date_desc", label: "Quote date: newest first", column: "quote_date", ascending: false },
  { value: "date_asc", label: "Quote date: oldest first", column: "quote_date", ascending: true },
  { value: "expiry_asc", label: "Expiry date: soonest first", column: "expiry_date", ascending: true },
  { value: "expiry_desc", label: "Expiry date: latest first", column: "expiry_date", ascending: false },
  { value: "number_desc", label: "Quote #: high to low", column: "quote_number", ascending: false },
  { value: "number_asc", label: "Quote #: low to high", column: "quote_number", ascending: true },
  { value: "total_desc", label: "Total: high to low", column: "total", ascending: false },
  { value: "total_asc", label: "Total: low to high", column: "total", ascending: true },
] as const satisfies readonly SortOption[];

export type InvoiceSortValue = (typeof INVOICE_SORT_OPTIONS)[number]["value"];
export type QuoteSortValue = (typeof QUOTE_SORT_OPTIONS)[number]["value"];

export const INVOICE_SORT_VALUES = INVOICE_SORT_OPTIONS.map((option) => option.value) as [
  InvoiceSortValue,
  ...InvoiceSortValue[],
];
export const QUOTE_SORT_VALUES = QUOTE_SORT_OPTIONS.map((option) => option.value) as [
  QuoteSortValue,
  ...QuoteSortValue[],
];

/** The option for a ?sort= value; anything unknown (an old bookmark, a hand-edited link) gets the first/default one. */
export function findSort<T extends SortOption>(options: readonly T[], value: string | undefined): T {
  return options.find((option) => option.value === value) ?? options[0];
}
