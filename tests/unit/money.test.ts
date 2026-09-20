import { describe, expect, it } from "vitest";
import { calculateLineTotals, formatCurrency, roundCents, sumLineTotals, toDbNumeric } from "@/lib/money";

describe("calculateLineTotals", () => {
  it("computes VAT-exclusive pricing correctly", () => {
    const result = calculateLineTotals({
      quantity: 2,
      unitPrice: 500,
      vatRatePercent: 15,
      priceIncludesVat: false,
    });

    expect(result.lineSubtotalExclVat.toString()).toBe("1000");
    expect(result.vatAmount.toString()).toBe("150");
    expect(result.lineTotal.toString()).toBe("1150");
  });

  it("computes VAT-inclusive pricing correctly (backs out VAT from the gross price)", () => {
    const result = calculateLineTotals({
      quantity: 1,
      unitPrice: 1150,
      vatRatePercent: 15,
      priceIncludesVat: true,
    });

    expect(result.lineSubtotalExclVat.toString()).toBe("1000");
    expect(result.vatAmount.toString()).toBe("150");
    expect(result.lineTotal.toString()).toBe("1150");
  });

  it("applies a percentage discount before VAT", () => {
    const result = calculateLineTotals({
      quantity: 1,
      unitPrice: 1000,
      discountPercent: 10,
      vatRatePercent: 15,
      priceIncludesVat: false,
    });

    expect(result.discountAmount.toString()).toBe("100");
    expect(result.lineSubtotalExclVat.toString()).toBe("900");
    expect(result.vatAmount.toString()).toBe("135");
    expect(result.lineTotal.toString()).toBe("1035");
  });

  it("handles a zero VAT rate", () => {
    const result = calculateLineTotals({
      quantity: 3,
      unitPrice: 100,
      vatRatePercent: 0,
      priceIncludesVat: false,
    });

    expect(result.vatAmount.toString()).toBe("0");
    expect(result.lineTotal.toString()).toBe("300");
  });

  it("never produces floating-point drift on repeating-decimal quantities", () => {
    const result = calculateLineTotals({
      quantity: 3,
      unitPrice: 0.1,
      vatRatePercent: 15,
      priceIncludesVat: false,
    });

    // Naive JS: 0.1 * 3 = 0.30000000000000004
    expect(result.lineSubtotalExclVat.toString()).toBe("0.3");
  });
});

describe("sumLineTotals", () => {
  it("sums subtotal + VAT - discount across multiple lines and reconciles to the total", () => {
    const line1 = calculateLineTotals({ quantity: 2, unitPrice: 500, vatRatePercent: 15, priceIncludesVat: false });
    const line2 = calculateLineTotals({
      quantity: 1,
      unitPrice: 200,
      discountPercent: 25,
      vatRatePercent: 15,
      priceIncludesVat: false,
    });

    const totals = sumLineTotals([line1, line2]);

    expect(totals.subtotal.plus(totals.vat).toString()).toBe(totals.total.toString());
    expect(totals.subtotal.toString()).toBe("1150");
    expect(totals.discount.toString()).toBe("50");
    expect(totals.vat.toString()).toBe("172.5");
    expect(totals.total.toString()).toBe("1322.5");
  });
});

describe("roundCents / toDbNumeric", () => {
  it("rounds half-up to two decimal places", () => {
    expect(roundCents("1.005").toString()).toBe("1.01");
    expect(roundCents("1.004").toString()).toBe("1");
  });

  it("always formats with exactly two decimal places for storage", () => {
    expect(toDbNumeric(10)).toBe("10.00");
    expect(toDbNumeric("10.5")).toBe("10.50");
  });
});

describe("formatCurrency", () => {
  it("formats ZAR amounts using South African grouping (spaces) and a comma decimal", () => {
    expect(formatCurrency(1250)).toBe("R 1 250,00");
  });
});
