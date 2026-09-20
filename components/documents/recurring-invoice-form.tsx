"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerSelect, type SelectableCustomer } from "@/components/documents/customer-select";
import { LineItemsEditor, type EditableProduct } from "@/components/documents/line-items-editor";
import {
  createRecurringInvoiceAction,
  updateRecurringInvoiceAction,
} from "@/server/actions/recurring-invoice-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { RecurringInvoiceWithItems } from "@/server/services/recurring-invoices";
import { RECURRING_FREQUENCIES, RECURRING_FREQUENCY_LABELS } from "@/lib/validations/recurring-invoices";

const initialState: ActionResult = {};

export function RecurringInvoiceForm({
  recurringInvoice,
  customers,
  products,
  defaultVatRate,
  defaultCurrency,
  initialCustomerId,
}: {
  recurringInvoice?: RecurringInvoiceWithItems;
  customers: SelectableCustomer[];
  products: EditableProduct[];
  defaultVatRate: number;
  defaultCurrency: string;
  initialCustomerId?: string;
}) {
  const action = recurringInvoice ? updateRecurringInvoiceAction : createRecurringInvoiceAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [customerId, setCustomerId] = useState<string | null>(
    recurringInvoice?.customer_id ?? initialCustomerId ?? null
  );
  const [pricesIncludeVat, setPricesIncludeVat] = useState(recurringInvoice?.prices_include_vat ?? false);
  const [frequency, setFrequency] = useState(recurringInvoice?.frequency ?? "monthly");
  const [autoGenerate, setAutoGenerate] = useState(recurringInvoice?.auto_generate ?? true);
  const [autoSendEmail, setAutoSendEmail] = useState(recurringInvoice?.auto_send_email ?? false);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6">
      {recurringInvoice ? <input type="hidden" name="id" value={recurringInvoice.id} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Recurring invoice details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer_id">Customer</Label>
            <CustomerSelect id="customer_id" customers={customers} value={customerId} onValueChange={setCustomerId} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              placeholder="e.g. Monthly IT Support"
              defaultValue={recurringInvoice?.description}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select
              name="frequency"
              value={frequency}
              onValueChange={(v) => v && setFrequency(v as typeof frequency)}
              items={RECURRING_FREQUENCY_LABELS}
            >
              <SelectTrigger id="frequency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRING_FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {RECURRING_FREQUENCY_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {frequency === "custom" ? (
            <div className="space-y-2">
              <Label htmlFor="custom_interval_days">Repeat every (days)</Label>
              <Input
                id="custom_interval_days"
                name="custom_interval_days"
                type="number"
                min={1}
                defaultValue={recurringInvoice?.custom_interval_days ?? ""}
                required
              />
            </div>
          ) : null}
          {!recurringInvoice ? (
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" defaultValue={today} required />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="end_date">End date</Label>
            <Input id="end_date" name="end_date" type="date" defaultValue={recurringInvoice?.end_date ?? ""} />
            <p className="text-xs text-muted-foreground">Leave blank to repeat indefinitely.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_terms_days">Payment terms (days)</Label>
            <Input
              id="payment_terms_days"
              name="payment_terms_days"
              type="number"
              min={0}
              placeholder="Use company default"
              defaultValue={recurringInvoice?.payment_terms_days ?? ""}
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch id="prices_include_vat" name="prices_include_vat" checked={pricesIncludeVat} onCheckedChange={setPricesIncludeVat} />
            <Label htmlFor="prices_include_vat">Prices include VAT</Label>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch id="auto_generate" name="auto_generate" checked={autoGenerate} onCheckedChange={setAutoGenerate} />
            <Label htmlFor="auto_generate">Automatically generate invoices</Label>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch id="auto_send_email" name="auto_send_email" checked={autoSendEmail} onCheckedChange={setAutoSendEmail} />
            <Label htmlFor="auto_send_email">Automatically email the customer</Label>
          </div>
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
            initialItems={recurringInvoice?.recurring_invoice_items.map((item) => ({
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
            <Label htmlFor="notes">Notes (appear on generated invoices)</Label>
            <Textarea id="notes" name="notes" defaultValue={recurringInvoice?.notes} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms">Terms</Label>
            <Textarea id="terms" name="terms" defaultValue={recurringInvoice?.terms} rows={3} />
          </div>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : recurringInvoice ? "Save changes" : "Create recurring invoice"}
      </Button>
    </form>
  );
}
