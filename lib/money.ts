import Decimal from "decimal.js";

/**
 * All monetary math goes through here — never plain `number` arithmetic for
 * money. Values are stored in Postgres as `numeric` and move through the
 * app as decimal strings until the final render step.
 */
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal;

export function money(value: Decimal.Value): Money {
  return new Decimal(value);
}

export function zero(): Money {
  return new Decimal(0);
}

/** Rounds to 2 decimal places (cents) using half-up rounding. */
export function roundCents(value: Decimal.Value): Money {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function formatCurrency(
  value: Decimal.Value,
  currency = "ZAR",
  locale = "en-ZA"
): string {
  const amount = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(amount);
}

export function toDbNumeric(value: Decimal.Value): string {
  return roundCents(value).toFixed(2);
}

export interface LineItemInput {
  quantity: Decimal.Value;
  unitPrice: Decimal.Value;
  discountPercent?: Decimal.Value;
  vatRatePercent: Decimal.Value;
  priceIncludesVat: boolean;
}

export interface LineItemTotals {
  lineSubtotalExclVat: Money;
  discountAmount: Money;
  vatAmount: Money;
  lineTotal: Money;
}

/**
 * Computes one invoice/quote line's totals. Always resolves to
 * exclusive-of-VAT subtotal + VAT = total, regardless of whether the entered
 * unit price was VAT-inclusive or VAT-exclusive.
 */
export function calculateLineTotals(input: LineItemInput): LineItemTotals {
  const quantity = money(input.quantity);
  const vatRate = money(input.vatRatePercent).dividedBy(100);
  const discountRate = money(input.discountPercent ?? 0).dividedBy(100);

  const grossUnitPrice = money(input.unitPrice);
  const exclVatUnitPrice = input.priceIncludesVat
    ? grossUnitPrice.dividedBy(vatRate.plus(1))
    : grossUnitPrice;

  const grossLine = exclVatUnitPrice.times(quantity);
  const discountAmount = roundCents(grossLine.times(discountRate));
  const lineSubtotalExclVat = roundCents(grossLine.minus(discountAmount));
  const vatAmount = roundCents(lineSubtotalExclVat.times(vatRate));
  const lineTotal = roundCents(lineSubtotalExclVat.plus(vatAmount));

  return { lineSubtotalExclVat, discountAmount, vatAmount, lineTotal };
}

export function sumLineTotals(lines: LineItemTotals[]) {
  return lines.reduce(
    (acc, line) => ({
      subtotal: acc.subtotal.plus(line.lineSubtotalExclVat),
      discount: acc.discount.plus(line.discountAmount),
      vat: acc.vat.plus(line.vatAmount),
      total: acc.total.plus(line.lineTotal),
    }),
    { subtotal: zero(), discount: zero(), vat: zero(), total: zero() }
  );
}
