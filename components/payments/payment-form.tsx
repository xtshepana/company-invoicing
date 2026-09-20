"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerSelect, type SelectableCustomer } from "@/components/documents/customer-select";
import { PaymentAllocationEditor } from "@/components/payments/payment-allocation-editor";
import { recordPaymentAction } from "@/server/actions/payment-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { OutstandingInvoice } from "@/server/services/payments";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validations/payments";

const initialState: ActionResult = {};

export function PaymentForm({
  customers,
  currency,
  initialCustomerId,
  initialInvoices,
  bankTransactionId,
  initialAmount,
  initialDate,
  initialReference,
  initialDescription,
}: {
  customers: SelectableCustomer[];
  currency: string;
  initialCustomerId?: string;
  initialInvoices?: OutstandingInvoice[];
  bankTransactionId?: string;
  initialAmount?: number;
  initialDate?: string;
  initialReference?: string;
  initialDescription?: string;
}) {
  const [state, formAction, pending] = useActionState(recordPaymentAction, initialState);
  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId ?? null);
  const [amount, setAmount] = useState(initialAmount ?? 0);
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>(initialInvoices ?? []);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  function handleCustomerChange(newCustomerId: string) {
    setCustomerId(newCustomerId);

    if (newCustomerId === initialCustomerId && initialInvoices) {
      setInvoices(initialInvoices);
      return;
    }

    setInvoices([]);
    setLoadingInvoices(true);
    fetch(`/api/customers/${newCustomerId}/outstanding-invoices`)
      .then((res) => res.json())
      .then((data) => setInvoices(data.invoices ?? []))
      .finally(() => setLoadingInvoices(false));
  }

  return (
    <form action={formAction} className="space-y-6">
      {bankTransactionId ? <input type="hidden" name="bank_transaction_id" value={bankTransactionId} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Payment details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer_id">Customer</Label>
            <CustomerSelect id="customer_id" customers={customers} value={customerId} onValueChange={handleCustomerChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_date">Payment date</Label>
            <Input
              id="payment_date"
              name="payment_date"
              type="date"
              defaultValue={initialDate || new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={0.01}
              step="0.01"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              readOnly={Boolean(bankTransactionId)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment method</Label>
            <Select name="payment_method" defaultValue="eft" items={PAYMENT_METHOD_LABELS}>
              <SelectTrigger id="payment_method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bank_reference">Bank reference</Label>
            <Input id="bank_reference" name="bank_reference" defaultValue={initialReference} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" defaultValue={initialDescription} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
        </CardContent>
      </Card>

      {customerId ? (
        <Card>
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInvoices ? (
              <p className="text-sm text-muted-foreground">Loading outstanding invoices…</p>
            ) : (
              <PaymentAllocationEditor
                key={customerId}
                name="invoice_allocations"
                invoices={invoices}
                paymentAmount={amount}
                currency={currency}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending || !customerId}>
        {pending ? "Saving…" : "Record payment"}
      </Button>
    </form>
  );
}
