import { parse as parseDate, isValid } from "date-fns";
import type { ColumnMapping, ColumnRole, ParsedSpreadsheet } from "@/lib/bank-import/types";
import type { NormalizedBankRow } from "@/lib/validations/bank-transactions";

export interface NormalizeRowError {
  rowIndex: number;
  message: string;
}

export interface NormalizeRowsResult {
  rows: NormalizedBankRow[];
  errors: NormalizeRowError[];
}

/**
 * Turns raw spreadsheet rows into the canonical shape the import RPC
 * expects, given the user's column mapping. Rows that fail to parse are
 * dropped (reported in `errors`) rather than failing the whole import —
 * one malformed row (a stray total/footer line banks often append)
 * shouldn't block importing the rest of a statement.
 */
export function normalizeRows(
  data: ParsedSpreadsheet,
  mapping: ColumnMapping,
  dateFormat: string,
  invertAmount: boolean
): NormalizeRowsResult {
  const dateCol = findColumn(mapping, "date");
  const descCol = findColumn(mapping, "description");
  const refCol = findColumn(mapping, "reference");
  const amountCol = findColumn(mapping, "amount");
  const debitCol = findColumn(mapping, "debit");
  const creditCol = findColumn(mapping, "credit");
  const balanceCol = findColumn(mapping, "balance");

  const rows: NormalizedBankRow[] = [];
  const errors: NormalizeRowError[] = [];

  data.rows.forEach((raw, rowIndex) => {
    const dateStr = dateCol != null ? (raw[dateCol] ?? "").trim() : "";
    const description = descCol != null ? (raw[descCol] ?? "").trim() : "";
    const reference = refCol != null ? (raw[refCol] ?? "").trim() : "";

    if (!dateStr || !description) {
      errors.push({ rowIndex, message: "Missing date or description." });
      return;
    }

    const parsedDate = parseDate(dateStr, dateFormat, new Date());
    if (!isValid(parsedDate)) {
      errors.push({ rowIndex, message: `Could not parse date "${dateStr}".` });
      return;
    }

    const amount = computeAmount(raw, amountCol, debitCol, creditCol, invertAmount);
    if (amount == null || Number.isNaN(amount) || amount === 0) {
      errors.push({ rowIndex, message: "Missing or invalid amount." });
      return;
    }

    const balanceRaw = balanceCol != null ? raw[balanceCol] : undefined;
    const balanceAfter = balanceRaw ? parseAmount(balanceRaw) : undefined;

    rows.push({
      transaction_date: formatLocalDate(parsedDate),
      description,
      reference,
      amount: roundCents(amount),
      balance_after: balanceAfter != null && !Number.isNaN(balanceAfter) ? balanceAfter : undefined,
    });
  });

  return { rows, errors };
}

function computeAmount(
  raw: string[],
  amountCol: number | null,
  debitCol: number | null,
  creditCol: number | null,
  invertAmount: boolean
): number | null {
  if (amountCol != null) {
    const value = parseAmount(raw[amountCol] ?? "");
    if (Number.isNaN(value)) return null;
    return invertAmount ? -value : value;
  }
  if (debitCol != null || creditCol != null) {
    const debit = debitCol != null ? parseAmount(raw[debitCol] ?? "") || 0 : 0;
    const credit = creditCol != null ? parseAmount(raw[creditCol] ?? "") || 0 : 0;
    return credit - debit;
  }
  return null;
}

function parseAmount(value: string): number {
  const cleaned = value.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  return parseFloat(cleaned);
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function findColumn(mapping: ColumnMapping, role: ColumnRole): number | null {
  const entry = Object.entries(mapping).find(([, r]) => r === role);
  return entry ? Number(entry[0]) : null;
}

/** Local-calendar-day formatting — never toISOString(), which shifts to UTC and can land on the wrong day depending on the browser's timezone. */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
