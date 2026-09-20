import { calculateLineTotals, sumLineTotals, toDbNumeric } from "@/lib/money";
import type { LineItemInput } from "@/lib/validations/line-items";

export interface ComputedLine {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  line_subtotal: string;
  line_vat: string;
  line_total: string;
  sort_order: number;
}

export interface DocumentTotals {
  subtotal: string;
  discount_total: string;
  vat_total: string;
  total: string;
}

/**
 * Computes per-line and document-level totals for a quote or invoice.
 * Shared by both so "subtotal + VAT - discount = total" is guaranteed to
 * reconcile the same way everywhere (see lib/money.ts).
 */
export function computeDocumentTotals(
  lineItems: LineItemInput[],
  pricesIncludeVat: boolean
): { lines: ComputedLine[]; totals: DocumentTotals } {
  const lineTotals = lineItems.map((item) =>
    calculateLineTotals({
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountPercent: item.discount_percent,
      vatRatePercent: item.vat_rate,
      priceIncludesVat: pricesIncludeVat,
    })
  );

  const lines: ComputedLine[] = lineItems.map((item, index) => ({
    product_id: item.product_id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_percent: item.discount_percent,
    vat_rate: item.vat_rate,
    line_subtotal: toDbNumeric(lineTotals[index].lineSubtotalExclVat),
    line_vat: toDbNumeric(lineTotals[index].vatAmount),
    line_total: toDbNumeric(lineTotals[index].lineTotal),
    sort_order: index,
  }));

  const summed = sumLineTotals(lineTotals);

  return {
    lines,
    totals: {
      subtotal: toDbNumeric(summed.subtotal),
      discount_total: toDbNumeric(summed.discount),
      vat_total: toDbNumeric(summed.vat),
      total: toDbNumeric(summed.total),
    },
  };
}
