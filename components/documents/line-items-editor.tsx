"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateLineTotals, formatCurrency, sumLineTotals } from "@/lib/money";
import type { LineItemInput } from "@/lib/validations/line-items";

export interface EditableProduct {
  id: string;
  name: string;
  selling_price: number;
  vat_rate: number;
}

export interface EditableLine extends LineItemInput {
  key: string;
}

let keyCounter = 0;
function nextKey() {
  keyCounter += 1;
  return `line-${keyCounter}`;
}

function emptyLine(defaultVatRate: number): EditableLine {
  return {
    key: nextKey(),
    product_id: null,
    description: "",
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    vat_rate: defaultVatRate,
  };
}

export function LineItemsEditor({
  name,
  products,
  defaultVatRate,
  pricesIncludeVat,
  currency = "ZAR",
  initialItems,
}: {
  name: string;
  products: EditableProduct[];
  defaultVatRate: number;
  pricesIncludeVat: boolean;
  currency?: string;
  initialItems?: LineItemInput[];
}) {
  const [lines, setLines] = useState<EditableLine[]>(() =>
    initialItems && initialItems.length > 0
      ? initialItems.map((item) => ({ ...item, key: nextKey() }))
      : [emptyLine(defaultVatRate)]
  );

  const productItems = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.name])),
    [products]
  );

  function updateLine(key: string, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function handleProductChange(key: string, productId: string) {
    if (productId === "__custom__") {
      updateLine(key, { product_id: null });
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    updateLine(key, {
      product_id: product.id,
      description: product.name,
      unit_price: product.selling_price,
      vat_rate: product.vat_rate,
    });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(defaultVatRate)]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.key !== key) : prev));
  }

  const computedLines = lines.map((line) =>
    calculateLineTotals({
      quantity: line.quantity || 0,
      unitPrice: line.unit_price || 0,
      discountPercent: line.discount_percent || 0,
      vatRatePercent: line.vat_rate || 0,
      priceIncludesVat: pricesIncludeVat,
    })
  );
  const totals = sumLineTotals(computedLines);

  const serialized: LineItemInput[] = lines.map((line) => ({
    product_id: line.product_id,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unit_price,
    discount_percent: line.discount_percent,
    vat_rate: line.vat_rate,
  }));

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(serialized)} />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Item</TableHead>
              <TableHead className="w-24">Qty</TableHead>
              <TableHead className="w-32">Unit price</TableHead>
              <TableHead className="w-24">Disc %</TableHead>
              <TableHead className="w-24">VAT %</TableHead>
              <TableHead className="w-32 text-right">Line total</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, index) => (
              <TableRow key={line.key}>
                <TableCell className="align-top">
                  <div className="space-y-1.5">
                    <Select
                      value={line.product_id ?? "__custom__"}
                      onValueChange={(v) => v && handleProductChange(line.key, v)}
                      items={{ __custom__: "Custom item", ...productItems }}
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__custom__">Custom item</SelectItem>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                      placeholder="Description"
                      rows={1}
                      className="min-h-8 resize-y text-sm"
                      required
                    />
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                    required
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) => updateLine(line.key, { unit_price: Number(e.target.value) })}
                    required
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={line.discount_percent}
                    onChange={(e) => updateLine(line.key, { discount_percent: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={line.vat_rate}
                    onChange={(e) => updateLine(line.key, { vat_rate: Number(e.target.value) })}
                    required
                  />
                </TableCell>
                <TableCell className="text-right align-top text-sm font-medium">
                  {formatCurrency(computedLines[index].lineTotal, currency)}
                </TableCell>
                <TableCell className="align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove line item"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addLine}>
        <Plus /> Add line
      </Button>

      <div className="ml-auto flex max-w-xs flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(totals.subtotal, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Discount</span>
          <span>-{formatCurrency(totals.discount, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">VAT</span>
          <span>{formatCurrency(totals.vat, currency)}</span>
        </div>
        <div className="flex justify-between border-t pt-1 font-semibold">
          <span>Total</span>
          <span>{formatCurrency(totals.total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
