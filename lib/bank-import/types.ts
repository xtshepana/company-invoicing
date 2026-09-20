export type ColumnRole = "date" | "description" | "reference" | "amount" | "debit" | "credit" | "balance" | "ignore";

export const COLUMN_ROLE_LABELS: Record<ColumnRole, string> = {
  date: "Date",
  description: "Description",
  reference: "Reference",
  amount: "Amount (signed: + in, − out)",
  debit: "Debit (money out)",
  credit: "Credit (money in)",
  balance: "Balance",
  ignore: "Ignore this column",
};

export interface ParsedSpreadsheet {
  headers: string[];
  rows: string[][];
}

/** Maps a column index in the parsed spreadsheet to the role it plays. */
export type ColumnMapping = Record<number, ColumnRole>;

export const DATE_FORMATS = [
  { value: "yyyy-MM-dd", label: "YYYY-MM-DD (2026-09-19)" },
  { value: "dd/MM/yyyy", label: "DD/MM/YYYY (19/09/2026)" },
  { value: "MM/dd/yyyy", label: "MM/DD/YYYY (09/19/2026)" },
  { value: "dd-MM-yyyy", label: "DD-MM-YYYY (19-09-2026)" },
  { value: "d MMM yyyy", label: "D MMM YYYY (19 Sep 2026)" },
] as const;
