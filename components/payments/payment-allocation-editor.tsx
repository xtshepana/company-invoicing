"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, roundCents } from "@/lib/money";
import type { OutstandingInvoice } from "@/server/services/payments";

export function PaymentAllocationEditor({
  name,
  invoices,
  paymentAmount,
  currency = "ZAR",
}: {
  name: string;
  invoices: OutstandingInvoice[];
  paymentAmount: number;
  currency?: string;
}) {
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  function toggleInvoice(invoiceId: string, checked: boolean, balance: number) {
    setAllocations((prev) => {
      const next = { ...prev };
      if (checked) {
        const remaining = Math.max(0, paymentAmount - sumAllocations(next));
        next[invoiceId] = Math.min(balance, remaining || balance);
      } else {
        delete next[invoiceId];
      }
      return next;
    });
  }

  function setAmount(invoiceId: string, amount: number) {
    setAllocations((prev) => ({ ...prev, [invoiceId]: amount }));
  }

  function autoAllocate() {
    let remaining = paymentAmount;
    const next: Record<string, number> = {};
    for (const invoice of invoices) {
      if (remaining <= 0) break;
      const amount = Math.min(invoice.balance_due, remaining);
      if (amount > 0) {
        next[invoice.id] = Number(roundCents(amount));
        remaining -= amount;
      }
    }
    setAllocations(next);
  }

  const totalAllocated = sumAllocations(allocations);
  const remainder = Math.max(0, paymentAmount - totalAllocated);

  const serialized = useMemo(
    () =>
      Object.entries(allocations)
        .filter(([, amount]) => amount > 0)
        .map(([invoice_id, amount]) => ({ invoice_id, amount })),
    [allocations]
  );

  if (invoices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This customer has no outstanding invoices. The full payment will be recorded as customer credit.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(serialized)} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Allocate this payment to outstanding invoices.</p>
        <Button type="button" variant="outline" size="sm" onClick={autoAllocate} disabled={paymentAmount <= 0}>
          Auto-allocate (oldest first)
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Invoice</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="w-36 text-right">Allocate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const checked = invoice.id in allocations;
              return (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleInvoice(invoice.id, value === true, invoice.balance_due)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>{new Date(invoice.due_date).toLocaleDateString("en-ZA")}</TableCell>
                  <TableCell className="text-right">{formatCurrency(invoice.balance_due, currency)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={invoice.balance_due}
                      step="0.01"
                      disabled={!checked}
                      value={allocations[invoice.id] ?? ""}
                      onChange={(e) => setAmount(invoice.id, Number(e.target.value))}
                      className="text-right"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="ml-auto flex max-w-xs flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Payment amount</span>
          <span>{formatCurrency(paymentAmount, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Allocated to invoices</span>
          <span>{formatCurrency(totalAllocated, currency)}</span>
        </div>
        <div className="flex justify-between border-t pt-1 font-semibold">
          <span>To customer credit</span>
          <span>{formatCurrency(remainder, currency)}</span>
        </div>
      </div>
    </div>
  );
}

function sumAllocations(allocations: Record<string, number>): number {
  return Object.values(allocations).reduce((sum, amount) => sum + (amount || 0), 0);
}
