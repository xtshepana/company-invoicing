"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerSelect, type SelectableCustomer } from "@/components/documents/customer-select";
import { LineItemsEditor, type EditableProduct } from "@/components/documents/line-items-editor";
import { createQuoteAction, updateQuoteAction } from "@/server/actions/quote-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { QuoteWithItems } from "@/server/services/quotes";

const initialState: ActionResult = {};

export function QuoteForm({
  quote,
  customers,
  products,
  defaultVatRate,
  defaultCurrency,
  defaultTerms,
  initialCustomerId,
  vatRegistered = true,
}: {
  quote?: QuoteWithItems;
  customers: SelectableCustomer[];
  products: EditableProduct[];
  defaultVatRate: number;
  defaultCurrency: string;
  defaultTerms: string;
  initialCustomerId?: string;
  vatRegistered?: boolean;
}) {
  const action = quote ? updateQuoteAction : createQuoteAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [customerId, setCustomerId] = useState<string | null>(quote?.customer_id ?? initialCustomerId ?? null);
  const [pricesIncludeVat, setPricesIncludeVat] = useState(quote?.prices_include_vat ?? false);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6">
      {quote ? <input type="hidden" name="id" value={quote.id} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Quote details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer_id">Customer</Label>
            <CustomerSelect id="customer_id" customers={customers} value={customerId} onValueChange={setCustomerId} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote_date">Quote date</Label>
            <Input id="quote_date" name="quote_date" type="date" defaultValue={quote?.quote_date ?? today} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiry_date">Expiry date</Label>
            <Input id="expiry_date" name="expiry_date" type="date" defaultValue={quote?.expiry_date ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference">Reference</Label>
            <Input id="reference" name="reference" defaultValue={quote?.reference} />
          </div>
          {vatRegistered && (
            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="prices_include_vat"
                name="prices_include_vat"
                checked={pricesIncludeVat}
                onCheckedChange={setPricesIncludeVat}
              />
              <Label htmlFor="prices_include_vat">Prices include VAT</Label>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <LineItemsEditor
            name="line_items"
            products={products}
            defaultVatRate={defaultVatRate}
            pricesIncludeVat={pricesIncludeVat}
            currency={defaultCurrency}
            vatRegistered={vatRegistered}
            initialItems={quote?.quote_items.map((item) => ({
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percent: item.discount_percent,
              vat_rate: item.vat_rate,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes &amp; terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={quote?.notes} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms">Terms</Label>
            <Textarea id="terms" name="terms" defaultValue={quote?.terms ?? defaultTerms} rows={3} />
          </div>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : quote ? "Save changes" : "Create quote"}
      </Button>
    </form>
  );
}
