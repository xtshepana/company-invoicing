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
 *
 * `vatRegistered` forces every line's vat_rate to 0 when false, regardless
 * of what a product's configured rate or the client sent - this is the
 * single enforcement point for company_settings.vat_registered, called
 * from every create/update action (invoice/quote/credit-note/recurring-
 * invoice) so a not-yet-VAT-registered business can never end up with a
 * document that charges VAT it isn't legally allowed to charge, no matter
 * what the UI did or didn't prevent client-side. Defaults to true so any
 * other/future caller isn't silently affected without opting in.
 */
export function computeDocumentTotals(
  lineItems: LineItemInput[],
  pricesIncludeVat: boolean,
  vatRegistered = true
): { lines: ComputedLine[]; totals: DocumentTotals } {
  const effectiveItems = vatRegistered ? lineItems : lineItems.map((item) => ({ ...item, vat_rate: 0 }));

  const lineTotals = effectiveItems.map((item) =>
    calculateLineTotals({
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountPercent: item.discount_percent,
      vatRatePercent: item.vat_rate,
      priceIncludesVat: pricesIncludeVat,
    })
  );

  const lines: ComputedLine[] = effectiveItems.map((item, index) => ({
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
