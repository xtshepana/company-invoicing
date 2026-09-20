import { describe, expect, it } from "vitest";
import { normalizeRows } from "@/lib/bank-import/normalize-rows";
import type { ColumnMapping, ParsedSpreadsheet } from "@/lib/bank-import/types";

function spreadsheet(headers: string[], rows: string[][]): ParsedSpreadsheet {
  return { headers, rows };
}

describe("normalizeRows", () => {
  it("parses a single signed-amount column", () => {
    const data = spreadsheet(
      ["Date", "Description", "Amount"],
      [
        ["19/09/2026", "Payment from ABC Technologies", "2875.00"],
        ["20/09/2026", "Bank fee", "-50.00"],
      ]
    );
    const mapping: ColumnMapping = { 0: "date", 1: "description", 2: "amount" };

    const result = normalizeRows(data, mapping, "dd/MM/yyyy", false);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toEqual([
      { transaction_date: "2026-09-19", description: "Payment from ABC Technologies", reference: "", amount: 2875, balance_after: undefined },
      { transaction_date: "2026-09-20", description: "Bank fee", reference: "", amount: -50, balance_after: undefined },
    ]);
  });

  it("inverts amounts when requested (bank exports deposits as negative)", () => {
    const data = spreadsheet(["Date", "Description", "Amount"], [["2026-09-19", "Deposit", "-2875.00"]]);
    const mapping: ColumnMapping = { 0: "date", 1: "description", 2: "amount" };

    const result = normalizeRows(data, mapping, "yyyy-MM-dd", true);

    expect(result.rows[0].amount).toBe(2875);
  });

  it("combines separate debit/credit columns into one signed amount", () => {
    const data = spreadsheet(
      ["Date", "Description", "Debit", "Credit"],
      [
        ["2026-09-19", "Deposit", "", "2875.00"],
        ["2026-09-20", "Fee", "50.00", ""],
      ]
    );
    const mapping: ColumnMapping = { 0: "date", 1: "description", 2: "debit", 3: "credit" };

    const result = normalizeRows(data, mapping, "yyyy-MM-dd", false);

    expect(result.rows[0].amount).toBe(2875);
    expect(result.rows[1].amount).toBe(-50);
  });

  it("skips rows with an unparseable date instead of failing the whole batch", () => {
    const data = spreadsheet(
      ["Date", "Description", "Amount"],
      [
        ["not-a-date", "Bad row", "100"],
        ["2026-09-19", "Good row", "100"],
      ]
    );
    const mapping: ColumnMapping = { 0: "date", 1: "description", 2: "amount" };

    const result = normalizeRows(data, mapping, "yyyy-MM-dd", false);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].description).toBe("Good row");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("not-a-date");
  });

  it("skips rows with a zero or missing amount", () => {
    const data = spreadsheet(
      ["Date", "Description", "Amount"],
      [
        ["2026-09-19", "Zero amount", "0"],
        ["2026-09-19", "Missing amount", ""],
      ]
    );
    const mapping: ColumnMapping = { 0: "date", 1: "description", 2: "amount" };

    const result = normalizeRows(data, mapping, "yyyy-MM-dd", false);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
  });

  it("captures the reference and balance columns when mapped", () => {
    const data = spreadsheet(
      ["Date", "Description", "Amount", "Ref", "Balance"],
      [["2026-09-19", "Payment", "100.00", "INV-000004", "5200.00"]]
    );
    const mapping: ColumnMapping = { 0: "date", 1: "description", 2: "amount", 3: "reference", 4: "balance" };

    const result = normalizeRows(data, mapping, "yyyy-MM-dd", false);

    expect(result.rows[0].reference).toBe("INV-000004");
    expect(result.rows[0].balance_after).toBe(5200);
  });

  it("handles thousands separators in amounts", () => {
    const data = spreadsheet(["Date", "Description", "Amount"], [["2026-09-19", "Big payment", "1,234.56"]]);
    const mapping: ColumnMapping = { 0: "date", 1: "description", 2: "amount" };

    const result = normalizeRows(data, mapping, "yyyy-MM-dd", false);

    expect(result.rows[0].amount).toBe(1234.56);
  });
});
