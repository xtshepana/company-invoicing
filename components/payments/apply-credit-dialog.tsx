"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { applyCustomerCreditAction } from "@/server/actions/payment-actions";
import { formatCurrency } from "@/lib/money";

export function ApplyCreditDialog({
  customerId,
  invoiceId,
  creditBalance,
  invoiceBalanceDue,
  currency,
}: {
  customerId: string;
  invoiceId: string;
  creditBalance: number;
  invoiceBalanceDue: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const maxAmount = Math.min(creditBalance, invoiceBalanceDue);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await applyCustomerCreditAction({}, formData);
      if (result.success) {
        toast.success("Credit applied.");
        setOpen(false);
        router.refresh();
      } else if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Wallet /> Apply Credit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply customer credit</DialogTitle>
          <DialogDescription>
            Available credit: {formatCurrency(creditBalance, currency)}. Invoice outstanding:{" "}
            {formatCurrency(invoiceBalanceDue, currency)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="customer_id" value={customerId} />
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <div className="space-y-2">
            <Label htmlFor="credit_amount">Amount to apply</Label>
            <Input
              id="credit_amount"
              name="amount"
              type="number"
              min={0.01}
              max={maxAmount}
              step="0.01"
              defaultValue={maxAmount}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit_notes">Notes</Label>
            <Input id="credit_notes" name="notes" />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Applying…" : "Apply credit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
