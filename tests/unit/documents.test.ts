import { describe, expect, it } from "vitest";
import { computeDocumentTotals } from "@/lib/documents";
import type { LineItemInput } from "@/lib/validations/line-items";

describe("computeDocumentTotals", () => {
  it("computes a single VAT-exclusive line and reconciles subtotal + VAT - discount = total", () => {
    const items: LineItemInput[] = [
      { product_id: null, description: "Monthly IT Support", quantity: 1, unit_price: 2500, discount_percent: 0, vat_rate: 15 },
    ];

    const { lines, totals } = computeDocumentTotals(items, false);

    expect(lines).toHaveLength(1);
    expect(lines[0].line_subtotal).toBe("2500.00");
    expect(lines[0].line_vat).toBe("375.00");
    expect(lines[0].line_total).toBe("2875.00");
    expect(totals.subtotal).toBe("2500.00");
    expect(totals.vat_total).toBe("375.00");
    expect(totals.total).toBe("2875.00");
  });

  it("sums multiple lines with discounts and mixed VAT rates", () => {
    const items: LineItemInput[] = [
      { product_id: null, description: "Line A", quantity: 2, unit_price: 500, discount_percent: 10, vat_rate: 15 },
      { product_id: null, description: "Line B", quantity: 1, unit_price: 1000, discount_percent: 0, vat_rate: 0 },
    ];

    const { totals } = computeDocumentTotals(items, false);

    // Line A: 1000 gross, 100 discount, 900 subtotal, 135 VAT, 1035 total
    // Line B: 1000 subtotal, 0 VAT, 1000 total
    expect(totals.subtotal).toBe("1900.00");
    expect(totals.discount_total).toBe("100.00");
    expect(totals.vat_total).toBe("135.00");
    expect(totals.total).toBe("2035.00");
  });

  it("backs VAT out of inclusive prices consistently across all lines", () => {
    const items: LineItemInput[] = [
      { product_id: null, description: "Item", quantity: 1, unit_price: 1150, discount_percent: 0, vat_rate: 15 },
    ];

    const { totals } = computeDocumentTotals(items, true);

    expect(totals.subtotal).toBe("1000.00");
    expect(totals.vat_total).toBe("150.00");
    expect(totals.total).toBe("1150.00");
  });

  it("always reconciles subtotal + vat - discount to the grand total for arbitrary inputs", () => {
    const items: LineItemInput[] = [
      { product_id: null, description: "A", quantity: 3, unit_price: 47.5, discount_percent: 12.5, vat_rate: 15 },
      { product_id: null, description: "B", quantity: 1, unit_price: 999.99, discount_percent: 5, vat_rate: 15 },
      { product_id: null, description: "C", quantity: 2.5, unit_price: 10, discount_percent: 0, vat_rate: 15 },
    ];

    const { totals } = computeDocumentTotals(items, false);
    const reconciled = Number(totals.subtotal) + Number(totals.vat_total);
    expect(reconciled).toBeCloseTo(Number(totals.total), 2);
  });
});
