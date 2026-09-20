import Papa from "papaparse";
import type ExcelJS from "exceljs";
import type { ParsedSpreadsheet } from "@/lib/bank-import/types";

/** Parses a bank statement export (CSV or Excel) into a raw header row + data rows, for the column-mapping UI. Runs client-side — nothing is uploaded until the user confirms the mapping. */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseExcelFile(file);
  }
  return parseCsvFile(file);
}

async function parseCsvFile(file: File): Promise<ParsedSpreadsheet> {
  const text = await file.text();
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const rows = result.data.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) return { headers: [], rows: [] };
  const [headers, ...dataRows] = rows;
  return { headers, rows: dataRows };
}

async function parseExcelFile(file: File): Promise<ParsedSpreadsheet> {
  const { default: ExcelJSModule } = await import("exceljs");
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJSModule.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { headers: [], rows: [] };

  const allRows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[];
    // row.values is 1-indexed (values[0] is undefined) — drop it to align with column 0.
    allRows.push(values.slice(1).map(cellToString));
  });

  const rows = allRows.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) return { headers: [], rows: [] };
  const [headers, ...dataRows] = rows;
  return { headers, rows: dataRows };
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return formatLocalDate(value);
  if (typeof value === "object") {
    if ("text" in value) return String((value as { text: unknown }).text ?? "");
    if ("result" in value) return String((value as { result: unknown }).result ?? "");
  }
  return String(value);
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
