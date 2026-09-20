"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { matchBankTransactionAction } from "@/server/actions/bank-transaction-actions";
import { formatCurrency } from "@/lib/money";
import type { CandidatePayment, CandidateInvoice, MatchConfidence } from "@/server/services/bank-transactions";

const CONFIDENCE_LABELS: Record<MatchConfidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const CONFIDENCE_VARIANTS: Record<MatchConfidence, "default" | "secondary" | "outline"> = {
  high: "default",
  medium: "outline",
  low: "secondary",
};

function ConfidenceBadge({ confidence }: { confidence: MatchConfidence }) {
  return (
    <Badge variant={CONFIDENCE_VARIANTS[confidence]} className="text-xs">
      {CONFIDENCE_LABELS[confidence]}
    </Badge>
  );
}

interface BankTransactionSummary {
  id: string;
  amount: number;
  transaction_date: string;
  description: string;
  reference: string | null;
}

export function MatchTransactionDialog({
  transaction,
  currency,
}: {
  transaction: BankTransactionSummary;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<CandidatePayment[]>([]);
  const [invoiceCandidates, setInvoiceCandidates] = useState<CandidateInvoice[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setLoading(true);
      fetch(`/api/bank-transactions/${transaction.id}/candidates`)
        .then((res) => res.json())
        .then((data) => {
          setCandidates(data.candidates ?? []);
          setInvoiceCandidates(data.invoiceCandidates ?? []);
        })
        .finally(() => setLoading(false));
    }
  }

  function newPaymentHrefForCustomer(customerId: string) {
    return (
      `/payments/new?customer=${customerId}&bank_transaction_id=${transaction.id}` +
      `&amount=${transaction.amount}&date=${transaction.transaction_date}` +
      `&reference=${encodeURIComponent(transaction.reference ?? "")}` +
      `&description=${encodeURIComponent(transaction.description)}`
    );
  }

  function handleMatch(paymentId: string) {
    const formData = new FormData();
    formData.set("transaction_id", transaction.id);
    formData.set("payment_id", paymentId);
    startTransition(async () => {
      const result = await matchBankTransactionAction({}, formData);
      if (result.success) {
        toast.success("Bank transaction matched to payment.");
        setOpen(false);
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  const newPaymentHref =
    `/payments/new?bank_transaction_id=${transaction.id}` +
    `&amount=${transaction.amount}&date=${transaction.transaction_date}` +
    `&reference=${encodeURIComponent(transaction.reference ?? "")}` +
    `&description=${encodeURIComponent(transaction.description)}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Link2 /> Match
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Match bank transaction</DialogTitle>
          <DialogDescription>
            {transaction.description} — {formatCurrency(transaction.amount, currency)} on{" "}
            {new Date(transaction.transaction_date).toLocaleDateString("en-ZA")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading candidates…</p>
        ) : (
          <div className="max-h-96 space-y-4 overflow-y-auto">
            {candidates.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Existing payments</p>
                {candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{candidate.customers?.company_name ?? "Unknown customer"}</div>
                      <div className="text-muted-foreground">
                        {new Date(candidate.payment_date).toLocaleDateString("en-ZA")}
                        {candidate.bank_reference ? ` · ${candidate.bank_reference}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConfidenceBadge confidence={candidate.confidence} />
                      <span className="font-medium">{formatCurrency(candidate.amount, currency)}</span>
                      <Button size="sm" disabled={pending} onClick={() => handleMatch(candidate.id)}>
                        Link
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {invoiceCandidates.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Suggested invoices — no payment recorded yet
                </p>
                {invoiceCandidates.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{invoice.customers?.company_name ?? "Unknown customer"}</div>
                      <div className="text-muted-foreground">
                        {invoice.invoice_number} · due {new Date(invoice.due_date).toLocaleDateString("en-ZA")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConfidenceBadge confidence={invoice.confidence} />
                      <span className="font-medium">{formatCurrency(invoice.balance_due, currency)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={newPaymentHrefForCustomer(invoice.customer_id)} />}
                        nativeButton={false}
                      >
                        Record Payment
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {candidates.length === 0 && invoiceCandidates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No unmatched payments or likely invoices found. Record a new payment for this transaction instead.
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="sm:justify-start">
          <Button variant="outline" render={<Link href={newPaymentHref} />} nativeButton={false}>
            Record New Payment Instead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
