"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerSelect, type SelectableCustomer } from "@/components/documents/customer-select";
import { LineItemsEditor, type EditableProduct } from "@/components/documents/line-items-editor";
import { createCreditNoteAction, updateCreditNoteAction } from "@/server/actions/credit-note-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { CreditNoteWithItems, CustomerInvoiceOption } from "@/server/services/credit-notes";

const initialState: ActionResult = {};
const NO_INVOICE = "__none__";

export function CreditNoteForm({
  creditNote,
  customers,
  products,
  defaultVatRate,
  defaultCurrency,
  defaultTerms,
  initialCustomerId,
  initialInvoiceId,
  initialInvoices,
  vatRegistered = true,
}: {
  creditNote?: CreditNoteWithItems;
  customers: SelectableCustomer[];
  products: EditableProduct[];
  defaultVatRate: number;
  defaultCurrency: string;
  defaultTerms: string;
  initialCustomerId?: string;
  initialInvoiceId?: string;
  initialInvoices?: CustomerInvoiceOption[];
  vatRegistered?: boolean;
}) {
  const action = creditNote ? updateCreditNoteAction : createCreditNoteAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const activeCustomerId = creditNote?.customer_id ?? initialCustomerId ?? null;
  const [customerId, setCustomerId] = useState<string | null>(activeCustomerId);
  const [pricesIncludeVat, setPricesIncludeVat] = useState(creditNote?.prices_include_vat ?? false);
  const [invoiceId, setInvoiceId] = useState<string>(creditNote?.invoice_id ?? initialInvoiceId ?? "");
  const [invoices, setInvoices] = useState<CustomerInvoiceOption[]>(initialInvoices ?? []);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  function handleCustomerChange(newCustomerId: string) {
    setCustomerId(newCustomerId);

    if (newCustomerId === activeCustomerId && initialInvoices) {
      setInvoices(initialInvoices);
      return;
    }

    setInvoiceId("");
    setInvoices([]);
    setLoadingInvoices(true);
    fetch(`/api/customers/${newCustomerId}/invoices`)
      .then((res) => res.json())
      .then((data) => setInvoices(data.invoices ?? []))
      .finally(() => setLoadingInvoices(false));
  }

  const invoiceItems: Record<string, string> = { [NO_INVOICE]: "No specific invoice" };
  for (const invoice of invoices) invoiceItems[invoice.id] = invoice.invoice_number;

  return (
    <form action={formAction} className="space-y-6">
      {creditNote ? <input type="hidden" name="id" value={creditNote.id} /> : null}
      <input type="hidden" name="invoice_id" value={invoiceId} />

      <Card>
        <CardHeader>
          <CardTitle>Credit note details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer_id">Customer</Label>
            <CustomerSelect id="customer_id" customers={customers} value={customerId} onValueChange={handleCustomerChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit_note_date">Credit note date</Label>
            <Input
              id="credit_note_date"
              name="credit_note_date"
              type="date"
              defaultValue={creditNote?.credit_note_date ?? today}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice_select">Relates to invoice (optional)</Label>
            <Select
              value={invoiceId || NO_INVOICE}
              onValueChange={(value) => value && setInvoiceId(value === NO_INVOICE ? "" : value)}
              items={invoiceItems}
              disabled={!customerId || loadingInvoices}
            >
              <SelectTrigger id="invoice_select" className="w-full">
                <SelectValue placeholder={loadingInvoices ? "Loading invoices…" : "No specific invoice"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_INVOICE}>No specific invoice</SelectItem>
                {invoices.map((invoice) => (
                  <SelectItem key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" name="reason" defaultValue={creditNote?.reason} placeholder="e.g. Returned goods" />
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
            initialItems={creditNote?.credit_note_items.map((item) => ({
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
            <Textarea id="notes" name="notes" defaultValue={creditNote?.notes} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms">Terms</Label>
            <Textarea id="terms" name="terms" defaultValue={creditNote?.terms ?? defaultTerms} rows={3} />
          </div>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending || !customerId}>
        {pending ? "Saving…" : creditNote ? "Save changes" : "Create credit note"}
      </Button>
    </form>
  );
}
