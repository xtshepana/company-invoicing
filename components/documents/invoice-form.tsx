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
import { createInvoiceAction, updateInvoiceAction } from "@/server/actions/invoice-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { InvoiceWithItems } from "@/server/services/invoices";

const initialState: ActionResult = {};

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function InvoiceForm({
  invoice,
  customers,
  products,
  defaultVatRate,
  defaultCurrency,
  defaultTerms,
  defaultPaymentTermsDays,
  initialCustomerId,
  vatRegistered = true,
}: {
  invoice?: InvoiceWithItems;
  customers: SelectableCustomer[];
  products: EditableProduct[];
  defaultVatRate: number;
  defaultCurrency: string;
  defaultTerms: string;
  defaultPaymentTermsDays: number;
  initialCustomerId?: string;
  vatRegistered?: boolean;
}) {
  const action = invoice ? updateInvoiceAction : createInvoiceAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [customerId, setCustomerId] = useState<string | null>(invoice?.customer_id ?? initialCustomerId ?? null);
  const [pricesIncludeVat, setPricesIncludeVat] = useState(invoice?.prices_include_vat ?? false);

  const today = new Date().toISOString().slice(0, 10);
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoice_date ?? today);
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? addDays(today, defaultPaymentTermsDays));

  return (
    <form action={formAction} className="space-y-6">
      {invoice ? <input type="hidden" name="id" value={invoice.id} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Invoice details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer_id">Customer</Label>
            <CustomerSelect id="customer_id" customers={customers} value={customerId} onValueChange={setCustomerId} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice_date">Invoice date</Label>
            <Input
              id="invoice_date"
              name="invoice_date"
              type="date"
              value={invoiceDate}
              onChange={(e) => {
                setInvoiceDate(e.target.value);
                if (!invoice) setDueDate(addDays(e.target.value, defaultPaymentTermsDays));
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_date">Due date</Label>
            <Input
              id="due_date"
              name="due_date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference">Reference</Label>
            <Input id="reference" name="reference" defaultValue={invoice?.reference} />
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
            initialItems={invoice?.invoice_items.map((item) => ({
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
            <Textarea id="notes" name="notes" defaultValue={invoice?.notes} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms">Terms</Label>
            <Textarea id="terms" name="terms" defaultValue={invoice?.terms ?? defaultTerms} rows={3} />
          </div>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : invoice ? "Save changes" : "Create invoice"}
      </Button>
    </form>
  );
}
